// 매수/매도 조건 태그 조합 및 RSI 임계값을 바꿔가며 수익률을 비교하는 전략 최적화 엔진.
// 이미 메모리에 올라온 지표(rows)만 사용하므로 외부 API 호출 없이 순수 계산만 수행한다.

import { runBacktest, type BacktestResult } from "./backtest";
import {
  PRESET_DEFAULT,
  SELL_PRESET_DEFAULT,
  SELL_TAG_META,
  TAG_META,
} from "./conditionTags";
import type { IndicatorRow } from "./indicators";
import {
  buildRsiOverboughtExitCheck,
  buildRsiReboundCheck,
  checkCustomBuySignal,
  checkCustomSellSignal,
  type SignalResult,
} from "./strategy";

const MAX_COMBO_SIZE = 3;
const TOP_N_PER_STAGE = 5;
const TOP_COMBOS_RETURNED = 15;

// RSI 임계값 민감도 탐색 그리드 (2~3 단위)
export const BUY_RSI_GRID = [25, 28, 31, 34, 37, 40];
export const SELL_RSI_GRID = [61, 64, 67, 70, 73, 76];

const BUY_TAG_IDS = TAG_META.map((t) => t.id);
const SELL_TAG_IDS = SELL_TAG_META.map((t) => t.id);

export interface StockDataset {
  stockCode: string;
  stockName: string;
  rows: IndicatorRow[];
  backtestStartDate: string;
  investPerStock: number;
}

export interface ComboResult {
  buyTags: string[];
  sellTags: string[];
  avgReturnPct: number;
  totalTrades: number;
  perStock: { stockCode: string; stockName: string; returnPct: number; trades: number }[];
}

export interface RsiSensitivityPoint {
  threshold: number;
  avgReturnPct: number;
}

export interface ComboSizeStat {
  size: number;
  avgReturnPct: number;
  count: number;
}

export interface PerStockComboResult {
  buyTags: string[];
  sellTags: string[];
  returnPct: number;
  trades: number;
}

export interface PerStockRanking {
  stockCode: string;
  stockName: string;
  topCombos: PerStockComboResult[];
}

export interface OptimizeReport {
  searchedCount: number;
  topCombos: ComboResult[];
  bestOverall: ComboResult;
  buyComboSizeStats: ComboSizeStat[];
  sellComboSizeStats: ComboSizeStat[];
  buyRsiSensitivity: RsiSensitivityPoint[];
  sellRsiSensitivity: RsiSensitivityPoint[];
  bestOverallResults: BacktestResult[];
  perStockRankings: PerStockRanking[];
}

function combinations<T>(pool: T[], size: number): T[][] {
  const results: T[][] = [];
  const combo: T[] = [];
  function helper(start: number) {
    if (combo.length === size) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < pool.length; i++) {
      combo.push(pool[i]);
      helper(i + 1);
      combo.pop();
    }
  }
  helper(0);
  return results;
}

function allCombosUpTo(pool: string[], maxSize: number): string[][] {
  const out: string[][] = [];
  for (let k = 1; k <= maxSize; k++) out.push(...combinations(pool, k));
  return out;
}

function evaluateCombo(
  datasets: StockDataset[],
  buyTags: string[],
  sellTags: string[],
): ComboResult {
  const buySignalFn = checkCustomBuySignal(buyTags);
  const sellSignalFn = checkCustomSellSignal(sellTags);
  const perStock = datasets.map((d) => {
    const result = runBacktest(
      d.stockCode,
      d.stockName,
      d.rows,
      d.backtestStartDate,
      d.investPerStock,
      buySignalFn,
      sellSignalFn,
    );
    return { stockCode: d.stockCode, stockName: d.stockName, returnPct: result.finalReturnPct, trades: result.trades.length };
  });
  const avgReturnPct = perStock.reduce((s, p) => s + p.returnPct, 0) / perStock.length;
  const totalTrades = perStock.reduce((s, p) => s + p.trades, 0);
  return { buyTags, sellTags, avgReturnPct, totalTrades, perStock };
}

function comboSizeStats(results: ComboResult[], sizeOf: (r: ComboResult) => number): ComboSizeStat[] {
  const bySize = new Map<number, { sum: number; count: number }>();
  for (const r of results) {
    const size = sizeOf(r);
    const entry = bySize.get(size) ?? { sum: 0, count: 0 };
    entry.sum += r.avgReturnPct;
    entry.count += 1;
    bySize.set(size, entry);
  }
  return Array.from(bySize.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([size, { sum, count }]) => ({ size, avgReturnPct: sum / count, count }));
}

function comboKey(buyTags: string[], sellTags: string[]): string {
  return `${buyTags.join(",")}|${sellTags.join(",")}`;
}

function dedupeCombos(results: ComboResult[]): ComboResult[] {
  const seen = new Set<string>();
  const out: ComboResult[] = [];
  for (const r of results) {
    const key = comboKey(r.buyTags, r.sellTags);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

const PER_STOCK_TOP_N = 5;

/** 이미 평가된 조합 풀(pool)을 종목별로 재정렬해 "이 종목엔 어떤 매매법이 잘 맞는지" 상위 N개를 뽑는다 */
function buildPerStockRankings(datasets: StockDataset[], pool: ComboResult[]): PerStockRanking[] {
  return datasets.map((d, idx) => {
    const sorted = [...pool].sort((a, b) => b.perStock[idx].returnPct - a.perStock[idx].returnPct);
    return {
      stockCode: d.stockCode,
      stockName: d.stockName,
      topCombos: sorted.slice(0, PER_STOCK_TOP_N).map((c) => ({
        buyTags: c.buyTags,
        sellTags: c.sellTags,
        returnPct: c.perStock[idx].returnPct,
        trades: c.perStock[idx].trades,
      })),
    };
  });
}

/** RSI 임계값(threshold)만 다른 단일조건 매수전략으로 수익률 민감도 측정 */
function evaluateBuyRsiThreshold(datasets: StockDataset[], threshold: number): number {
  const check = buildRsiReboundCheck(threshold);
  const buySignalFn = (rows: IndicatorRow[]): SignalResult => {
    if (rows.length < 30) return { signal: "HOLD", reason: "데이터 부족" };
    return check(rows)
      ? { signal: "BUY", reason: `RSI ${threshold} 이탈복귀` }
      : { signal: "HOLD", reason: "조건 미충족" };
  };
  const sellSignalFn = checkCustomSellSignal(SELL_PRESET_DEFAULT);
  const returns = datasets.map(
    (d) =>
      runBacktest(d.stockCode, d.stockName, d.rows, d.backtestStartDate, d.investPerStock, buySignalFn, sellSignalFn)
        .finalReturnPct,
  );
  return returns.reduce((s, v) => s + v, 0) / returns.length;
}

/** RSI 임계값(threshold)만 다른 단일조건 매도전략으로 수익률 민감도 측정 */
function evaluateSellRsiThreshold(datasets: StockDataset[], threshold: number): number {
  const check = buildRsiOverboughtExitCheck(threshold);
  const sellSignalFn = (rows: IndicatorRow[], avgBuyPrice: number): SignalResult => {
    const cur = rows.at(-1)!;
    const changePct = ((cur.close - avgBuyPrice) / avgBuyPrice) * 100;
    return check(rows)
      ? { signal: "SELL", reason: `RSI ${threshold} 과매수이탈 (${changePct.toFixed(1)}%)` }
      : { signal: "HOLD", reason: `보유 유지 (${changePct.toFixed(1)}%)` };
  };
  const buySignalFn = checkCustomBuySignal(PRESET_DEFAULT);
  const returns = datasets.map(
    (d) =>
      runBacktest(d.stockCode, d.stockName, d.rows, d.backtestStartDate, d.investPerStock, buySignalFn, sellSignalFn)
        .finalReturnPct,
  );
  return returns.reduce((s, v) => s + v, 0) / returns.length;
}

/**
 * 매수/매도 태그 조합(1~3개) 및 RSI 임계값을 바꿔가며 백테스트를 반복 실행해 가장 수익률이 좋은
 * 조합을 찾는다. 전수조사(부분집합 곱)는 계산량이 너무 커서, 매수조합 우선탐색 → 매도조합 우선탐색
 * → 상위 조합끼리 교차검증 순서의 단계적(greedy) 탐색을 사용한다.
 */
export function runOptimization(datasets: StockDataset[]): OptimizeReport {
  const buyCombos = allCombosUpTo(BUY_TAG_IDS, MAX_COMBO_SIZE);
  const sellCombos = allCombosUpTo(SELL_TAG_IDS, MAX_COMBO_SIZE);
  let searchedCount = 0;

  // 1단계: 매도조건은 기존 전략(SELL_PRESET_DEFAULT)으로 고정하고 매수조합만 변경
  const stage1 = buyCombos.map((buyTags) => {
    searchedCount++;
    return evaluateCombo(datasets, buyTags, SELL_PRESET_DEFAULT);
  });
  const stage1Sorted = [...stage1].sort((a, b) => b.avgReturnPct - a.avgReturnPct);
  const topBuy = stage1Sorted.slice(0, TOP_N_PER_STAGE).map((r) => r.buyTags);

  // 2단계: 매수조건은 기존 전략(PRESET_DEFAULT)으로 고정하고 매도조합만 변경
  const stage2 = sellCombos.map((sellTags) => {
    searchedCount++;
    return evaluateCombo(datasets, PRESET_DEFAULT, sellTags);
  });
  const stage2Sorted = [...stage2].sort((a, b) => b.avgReturnPct - a.avgReturnPct);
  const topSell = stage2Sorted.slice(0, TOP_N_PER_STAGE).map((r) => r.sellTags);

  // 3단계: 각 단계 상위 조합끼리 교차 검증 (매수x매도 상호작용 확인)
  const crossResults: ComboResult[] = [];
  for (const buyTags of topBuy) {
    for (const sellTags of topSell) {
      searchedCount++;
      crossResults.push(evaluateCombo(datasets, buyTags, sellTags));
    }
  }

  const candidates = [...stage1Sorted.slice(0, TOP_COMBOS_RETURNED), ...stage2Sorted.slice(0, TOP_COMBOS_RETURNED), ...crossResults];
  candidates.sort((a, b) => b.avgReturnPct - a.avgReturnPct);

  const seen = new Set<string>();
  const topCombos: ComboResult[] = [];
  for (const c of candidates) {
    const key = comboKey(c.buyTags, c.sellTags);
    if (seen.has(key)) continue;
    seen.add(key);
    topCombos.push(c);
    if (topCombos.length >= TOP_COMBOS_RETURNED) break;
  }

  const bestOverall = topCombos[0];

  const buyRsiSensitivity: RsiSensitivityPoint[] = BUY_RSI_GRID.map((threshold) => {
    searchedCount++;
    return { threshold, avgReturnPct: evaluateBuyRsiThreshold(datasets, threshold) };
  });

  const sellRsiSensitivity: RsiSensitivityPoint[] = SELL_RSI_GRID.map((threshold) => {
    searchedCount++;
    return { threshold, avgReturnPct: evaluateSellRsiThreshold(datasets, threshold) };
  });

  const bestBuySignalFn = checkCustomBuySignal(bestOverall.buyTags);
  const bestSellSignalFn = checkCustomSellSignal(bestOverall.sellTags);
  const bestOverallResults = datasets.map((d) =>
    runBacktest(
      d.stockCode,
      d.stockName,
      d.rows,
      d.backtestStartDate,
      d.investPerStock,
      bestBuySignalFn,
      bestSellSignalFn,
    ),
  );

  // 종목별 랭킹은 실제 탐색된 전체 조합 풀(매수전용 575 + 매도전용 377 + 교차검증 25)을 재사용해,
  // 평균 수익률이 아니라 "그 종목만의" 수익률 기준으로 다시 정렬한다 (추가 백테스트 실행 없음)
  const evaluatedPool = dedupeCombos([...stage1, ...stage2, ...crossResults]);
  const perStockRankings = buildPerStockRankings(datasets, evaluatedPool);

  return {
    searchedCount,
    topCombos,
    bestOverall,
    buyComboSizeStats: comboSizeStats(stage1, (r) => r.buyTags.length),
    sellComboSizeStats: comboSizeStats(stage2, (r) => r.sellTags.length),
    buyRsiSensitivity,
    sellRsiSensitivity,
    bestOverallResults,
    perStockRankings,
  };
}
