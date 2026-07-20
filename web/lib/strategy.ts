import {
  GC_WINDOW,
  RSI_OVERSOLD,
  RSI_REBOUND_WINDOW,
  STOP_LOSS_PCT,
  TAKE_PROFIT_PCT,
  VOLUME_SURGE_MULT,
} from "./config";
import type { IndicatorRow } from "./indicators";

export type Signal = "BUY" | "SELL" | "HOLD";

export interface SignalResult {
  signal: Signal;
  reason: string;
}

/** 최근 N일 이내에 골든크로스(MA5가 MA20을 상향 돌파)가 발생했는지 */
function goldenCrossWithinWindow(rows: IndicatorRow[], window: number): boolean {
  const n = rows.length;
  for (let i = n - window; i < n; i++) {
    if (i <= 0) continue;
    const prev = rows[i - 1];
    const cur = rows[i];
    if (prev.ma5 <= prev.ma20 && cur.ma5 > cur.ma20) return true;
  }
  return false;
}

/** 가장 최근 시점에 데드크로스(MA5가 MA20을 하향 돌파)가 발생했는지 */
function deadCrossJustHappened(rows: IndicatorRow[]): boolean {
  const n = rows.length;
  if (n < 2) return false;
  const prev = rows[n - 2];
  const cur = rows[n - 1];
  return prev.ma5 >= prev.ma20 && cur.ma5 < cur.ma20;
}

/** MACD가 Signal선을 상향 돌파했는지 (가장 최근 시점) */
function macdCrossedUp(rows: IndicatorRow[]): boolean {
  const n = rows.length;
  if (n < 2) return false;
  const prev = rows[n - 2];
  const cur = rows[n - 1];
  return prev.macd <= prev.macdSignal && cur.macd > cur.macdSignal;
}

/** MACD 히스토그램이 양(+)에서 음(-)으로 전환됐는지 */
function macdHistTurnedNegative(rows: IndicatorRow[]): boolean {
  const n = rows.length;
  if (n < 2) return false;
  const prev = rows[n - 2];
  const cur = rows[n - 1];
  return prev.macdHist > 0 && cur.macdHist <= 0;
}

/** MACD 히스토그램이 음(-)에서 양(+)으로 전환됐는지 */
function macdHistTurnedPositive(rows: IndicatorRow[]): boolean {
  const n = rows.length;
  if (n < 2) return false;
  const prev = rows[n - 2];
  const cur = rows[n - 1];
  return prev.macdHist <= 0 && cur.macdHist > 0;
}

/** 최근 N일 내 RSI가 과매도(oversold) 구간을 찍고 현재는 그 위로 복귀했는지 */
function rsiReboundFromOversold(rows: IndicatorRow[], window: number): boolean {
  const n = rows.length;
  const cur = rows[n - 1];
  if (Number.isNaN(cur.rsi) || cur.rsi <= RSI_OVERSOLD) return false;
  for (let i = Math.max(0, n - 1 - window); i < n - 1; i++) {
    if (rows[i].rsi <= RSI_OVERSOLD) return true;
  }
  return false;
}

function averageVolume(rows: IndicatorRow[], lookback = 20): number {
  const slice = rows.slice(-lookback - 1, -1); // 오늘 제외 직전 lookback일
  if (slice.length === 0) return 0;
  return slice.reduce((sum, r) => sum + r.volume, 0) / slice.length;
}

/**
 * 매수 시그널 판정 (보유하지 않은 종목 대상)
 * AND: 골든크로스(N일 이내) + MACD 0선 위 + MACD 상향돌파 + 거래량 급증
 */
export function checkBuySignal(rows: IndicatorRow[]): SignalResult {
  if (rows.length < 30) return { signal: "HOLD", reason: "데이터 부족" };

  const cur = rows[rows.length - 1];
  const conditions = {
    goldenCross: goldenCrossWithinWindow(rows, GC_WINDOW),
    macdAboveZero: cur.macd > 0,
    macdCrossedUp: macdCrossedUp(rows),
    volumeSurge: cur.volume >= averageVolume(rows) * VOLUME_SURGE_MULT,
  };

  const allMet = Object.values(conditions).every(Boolean);
  if (!allMet) return { signal: "HOLD", reason: JSON.stringify(conditions) };

  return { signal: "BUY", reason: "골든크로스+MACD상향돌파+거래량급증" };
}

/**
 * 합류(confluence) 전략 매수 시그널 판정
 * AND: MA 정배열(MA5>MA20) + RSI 과매도(30) 이탈 복귀(N일 이내) + MACD 모멘텀 전환(상향돌파 또는 히스토그램 양전환)
 */
export function checkConfluenceBuySignal(rows: IndicatorRow[]): SignalResult {
  if (rows.length < 30) return { signal: "HOLD", reason: "데이터 부족" };

  const cur = rows[rows.length - 1];
  const conditions = {
    trendAligned: cur.ma5 > cur.ma20,
    rsiRebound: rsiReboundFromOversold(rows, RSI_REBOUND_WINDOW),
    macdMomentum: macdCrossedUp(rows) || macdHistTurnedPositive(rows),
  };

  const allMet = Object.values(conditions).every(Boolean);
  if (!allMet) return { signal: "HOLD", reason: JSON.stringify(conditions) };

  return { signal: "BUY", reason: "MA정배열+RSI과매도복귀+MACD모멘텀전환" };
}

/**
 * 매도 시그널 판정 (보유 중인 종목 대상)
 * OR: 히스토그램 양->음 전환 / 데드크로스 / MACD 0선 이하 / 손절 / 익절
 */
export function checkSellSignal(
  rows: IndicatorRow[],
  avgBuyPrice: number,
): SignalResult {
  const cur = rows[rows.length - 1];
  const changePct = ((cur.close - avgBuyPrice) / avgBuyPrice) * 100;

  if (changePct <= STOP_LOSS_PCT) {
    return { signal: "SELL", reason: `손절 도달 (${changePct.toFixed(1)}%)` };
  }
  if (changePct >= TAKE_PROFIT_PCT) {
    return { signal: "SELL", reason: `익절 도달 (${changePct.toFixed(1)}%)` };
  }
  if (macdHistTurnedNegative(rows)) {
    return { signal: "SELL", reason: "MACD 히스토그램 양→음 전환" };
  }
  if (deadCrossJustHappened(rows)) {
    return { signal: "SELL", reason: "데드크로스 발생" };
  }
  if (cur.macd <= 0) {
    return { signal: "SELL", reason: "MACD 0선 이하" };
  }

  return { signal: "HOLD", reason: `보유 유지 (${changePct.toFixed(1)}%)` };
}
