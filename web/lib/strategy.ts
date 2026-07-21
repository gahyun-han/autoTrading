import {
  ADX_TREND_THRESHOLD,
  GC_WINDOW,
  NEW_HIGH_BREAKOUT_WINDOW,
  RSI_OVERSOLD,
  RSI_REBOUND_WINDOW,
  STOCH_OVERSOLD,
  STOP_LOSS_PCT,
  TAKE_PROFIT_PCT,
  TAKE_PROFIT_RANGE_MIN,
  VOLUME_SURGE_MULT,
} from "./config";
import { SELL_TAG_META, TAG_META } from "./conditionTags";
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
function rsiReboundFromOversold(rows: IndicatorRow[], window: number, threshold = RSI_OVERSOLD): boolean {
  const n = rows.length;
  const cur = rows[n - 1];
  if (Number.isNaN(cur.rsi) || cur.rsi <= threshold) return false;
  for (let i = Math.max(0, n - 1 - window); i < n - 1; i++) {
    if (rows[i].rsi <= threshold) return true;
  }
  return false;
}

/** 최근 N일 내에 MACD 모멘텀 전환(상향돌파 또는 히스토그램 양전환)이 발생했는지 */
function macdMomentumWithinWindow(rows: IndicatorRow[], window: number): boolean {
  const n = rows.length;
  for (let i = Math.max(1, n - window); i < n; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    const crossedUp = prev.macd <= prev.macdSignal && cur.macd > cur.macdSignal;
    const histTurnedPositive = prev.macdHist <= 0 && cur.macdHist > 0;
    if (crossedUp || histTurnedPositive) return true;
  }
  return false;
}

function averageVolume(rows: IndicatorRow[], lookback = 20): number {
  const slice = rows.slice(-lookback - 1, -1); // 오늘 제외 직전 lookback일
  if (slice.length === 0) return 0;
  return slice.reduce((sum, r) => sum + r.volume, 0) / slice.length;
}

/** MA20 기울기가 직전(상승/보합, >=0)에서 이번(하락, <0)으로 전환됐는지 */
function ma20SlopeTurnedNegative(rows: IndicatorRow[]): boolean {
  const n = rows.length;
  if (n < 3) return false;
  const a = rows[n - 3].ma20;
  const b = rows[n - 2].ma20;
  const c = rows[n - 1].ma20;
  if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) return false;
  const prevSlope = b - a;
  const curSlope = c - b;
  return prevSlope >= 0 && curSlope < 0;
}

/** 최근 N일 내 RSI가 과매수(threshold) 이상을 찍은 뒤 현재는 그 아래로 이탈했는지 */
function rsiExitFromOverbought(rows: IndicatorRow[], window: number, threshold = 70): boolean {
  const n = rows.length;
  const cur = rows[n - 1];
  if (Number.isNaN(cur.rsi) || cur.rsi >= threshold) return false;
  for (let i = Math.max(0, n - 1 - window); i < n - 1; i++) {
    if (rows[i].rsi >= threshold) return true;
  }
  return false;
}

/** 최근 N일 내 볼린저 상단을 터치한 뒤, 현재 종가가 상단 아래로 되돌아왔는지 (되돌림/추세 실패) */
function bollingerUpperTouchThenBack(rows: IndicatorRow[], window: number): boolean {
  const n = rows.length;
  const cur = rows[n - 1];
  if (Number.isNaN(cur.bbUpper) || cur.close >= cur.bbUpper) return false;
  for (let i = Math.max(0, n - 1 - window); i < n - 1; i++) {
    if (!Number.isNaN(rows[i].bbUpper) && rows[i].close >= rows[i].bbUpper) return true;
  }
  return false;
}

/** 종가가 볼린저 하단을 이탈했는지 (추세 붕괴) */
function bollingerLowerBreak(rows: IndicatorRow[]): boolean {
  const c = rows.at(-1)!;
  return !Number.isNaN(c.bbLower) && c.close < c.bbLower;
}

/** 종가가 일목균형표 구름대 아래로 하향 이탈했는지 */
function closeBelowCloud(rows: IndicatorRow[]): boolean {
  const c = rows.at(-1)!;
  if (Number.isNaN(c.spanA) || Number.isNaN(c.spanB)) return false;
  return c.close < Math.min(c.spanA, c.spanB);
}

/** 전환선이 기준선을 하향 돌파했는지 (일목균형표 데드크로스) */
function tenkanCrossedDownKijun(rows: IndicatorRow[]): boolean {
  const n = rows.length;
  if (n < 2) return false;
  const prev = rows[n - 2];
  const cur = rows[n - 1];
  if (
    Number.isNaN(prev.tenkan) ||
    Number.isNaN(prev.kijun) ||
    Number.isNaN(cur.tenkan) ||
    Number.isNaN(cur.kijun)
  ) {
    return false;
  }
  return prev.tenkan >= prev.kijun && cur.tenkan < cur.kijun;
}

/** 거래량 급증 + 음봉 (대량 매물 출회로 해석되는 분산일) */
function volumeClimaxDown(rows: IndicatorRow[]): boolean {
  const c = rows.at(-1)!;
  return c.volume >= averageVolume(rows) * VOLUME_SURGE_MULT && c.close < c.open;
}

/** 최근 N일 내 볼린저 하단을 터치한 뒤, 현재 종가가 하단 위로 되돌아왔는지 (과매도 반등) */
function bollingerLowerTouchThenBack(rows: IndicatorRow[], window: number): boolean {
  const n = rows.length;
  const cur = rows[n - 1];
  if (Number.isNaN(cur.bbLower) || cur.close <= cur.bbLower) return false;
  for (let i = Math.max(0, n - 1 - window); i < n - 1; i++) {
    if (!Number.isNaN(rows[i].bbLower) && rows[i].close <= rows[i].bbLower) return true;
  }
  return false;
}

/** 현재 종가가 직전 window일(오늘 제외) 중 최고가를 상향 돌파했는지 (N일 신고가 돌파) */
function newHighBreakout(rows: IndicatorRow[], window: number): boolean {
  const n = rows.length;
  const cur = rows[n - 1];
  const slice = rows.slice(Math.max(0, n - 1 - window), n - 1);
  if (slice.length === 0) return false;
  const priorHigh = Math.max(...slice.map((r) => r.high));
  return cur.close > priorHigh;
}

/** 최근 N일 내 스토캐스틱 %K가 과매도(oversold) 구간 아래에 있었고, 가장 최근 시점에 %K가 %D를 상향 돌파했는지 */
function stochasticOversoldCross(rows: IndicatorRow[], window: number): boolean {
  const n = rows.length;
  if (n < 2) return false;
  const prev = rows[n - 2];
  const cur = rows[n - 1];
  if (
    Number.isNaN(prev.stochK) ||
    Number.isNaN(prev.stochD) ||
    Number.isNaN(cur.stochK) ||
    Number.isNaN(cur.stochD)
  ) {
    return false;
  }
  const crossedUp = prev.stochK <= prev.stochD && cur.stochK > cur.stochD;
  if (!crossedUp) return false;
  for (let i = Math.max(0, n - 1 - window); i < n; i++) {
    if (!Number.isNaN(rows[i].stochK) && rows[i].stochK <= STOCH_OVERSOLD) return true;
  }
  return false;
}

/** OBV 단기 이동평균이 장기 이동평균 위에 있는지 (거래량 동반 상승추세 확인) */
function obvRisingTrend(rows: IndicatorRow[]): boolean {
  const c = rows.at(-1)!;
  return !Number.isNaN(c.obvSma5) && !Number.isNaN(c.obvSma20) && c.obvSma5 > c.obvSma20;
}

/** ADX가 추세강도 임계값 이상인지 (추세 구간 필터, 다른 매수 조건과 함께 사용) */
function adxStrongTrend(rows: IndicatorRow[]): boolean {
  const c = rows.at(-1)!;
  return !Number.isNaN(c.adx) && c.adx >= ADX_TREND_THRESHOLD;
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
 * AND: MA 정배열(MA5>MA20) + RSI 과매도 이탈 복귀(N일 이내) + MACD 모멘텀 전환(N일 이내, 상향돌파 또는 히스토그램 양전환)
 */
export function checkConfluenceBuySignal(rows: IndicatorRow[]): SignalResult {
  if (rows.length < 30) return { signal: "HOLD", reason: "데이터 부족" };

  const cur = rows[rows.length - 1];
  const conditions = {
    trendAligned: cur.ma5 > cur.ma20,
    rsiRebound: rsiReboundFromOversold(rows, RSI_REBOUND_WINDOW),
    macdMomentum: macdMomentumWithinWindow(rows, RSI_REBOUND_WINDOW),
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

/** 태그(해시태그) 조합 커스텀 매수 조건 판정용 개별 체크 함수 모음 */
const TAG_CHECKS: Record<string, (rows: IndicatorRow[]) => boolean> = {
  "ma5-gt-ma20": (rows) => {
    const c = rows.at(-1)!;
    return !Number.isNaN(c.ma5) && !Number.isNaN(c.ma20) && c.ma5 > c.ma20;
  },
  "ma20-gt-ma60": (rows) => {
    const c = rows.at(-1)!;
    return !Number.isNaN(c.ma20) && !Number.isNaN(c.ma60) && c.ma20 > c.ma60;
  },
  "ma60-gt-ma120": (rows) => {
    const c = rows.at(-1)!;
    return !Number.isNaN(c.ma60) && !Number.isNaN(c.ma120) && c.ma60 > c.ma120;
  },
  "golden-cross": (rows) => goldenCrossWithinWindow(rows, GC_WINDOW),
  "dead-cross": (rows) => deadCrossJustHappened(rows),
  "rsi-30-rebound": (rows) => rsiReboundFromOversold(rows, RSI_REBOUND_WINDOW, 30),
  "rsi-40-rebound": (rows) => rsiReboundFromOversold(rows, RSI_REBOUND_WINDOW, 40),
  "macd-above-zero": (rows) => rows.at(-1)!.macd > 0,
  "macd-cross-up": (rows) => macdCrossedUp(rows),
  "macd-hist-positive": (rows) => macdHistTurnedPositive(rows),
  "macd-momentum-window": (rows) => macdMomentumWithinWindow(rows, RSI_REBOUND_WINDOW),
  "volume-surge": (rows) => {
    const c = rows.at(-1)!;
    return c.volume >= averageVolume(rows) * VOLUME_SURGE_MULT;
  },
  "ichimoku-tenkan-gt-kijun": (rows) => {
    const c = rows.at(-1)!;
    return !Number.isNaN(c.tenkan) && !Number.isNaN(c.kijun) && c.tenkan > c.kijun;
  },
  "ichimoku-bullish-cloud": (rows) => {
    const c = rows.at(-1)!;
    return !Number.isNaN(c.spanA) && !Number.isNaN(c.spanB) && c.spanA > c.spanB;
  },
  "ichimoku-above-cloud": (rows) => {
    const c = rows.at(-1)!;
    if (Number.isNaN(c.spanA) || Number.isNaN(c.spanB)) return false;
    return c.close > Math.max(c.spanA, c.spanB);
  },
  "bollinger-lower-touch-back": (rows) => bollingerLowerTouchThenBack(rows, RSI_REBOUND_WINDOW),
  "new-high-breakout": (rows) => newHighBreakout(rows, NEW_HIGH_BREAKOUT_WINDOW),
  "stochastic-oversold-cross": (rows) => stochasticOversoldCross(rows, RSI_REBOUND_WINDOW),
  "obv-rising": (rows) => obvRisingTrend(rows),
  "adx-strong-trend": (rows) => adxStrongTrend(rows),
};

/**
 * 사용자가 선택한 태그(해시태그) 조합을 모두 AND로 만족해야 BUY.
 * 선택된 태그가 없으면 항상 HOLD.
 */
export function checkCustomBuySignal(tagIds: string[]): (rows: IndicatorRow[]) => SignalResult {
  return (rows: IndicatorRow[]): SignalResult => {
    if (rows.length < 30) return { signal: "HOLD", reason: "데이터 부족" };
    if (tagIds.length === 0) return { signal: "HOLD", reason: "선택된 조건 없음" };

    const labelOf = (id: string) => TAG_META.find((t) => t.id === id)?.label ?? id;
    const evaluated = tagIds.map((id) => ({
      id,
      label: labelOf(id),
      met: TAG_CHECKS[id] ? TAG_CHECKS[id](rows) : false,
    }));

    const allMet = evaluated.every((e) => e.met);
    if (!allMet) {
      return {
        signal: "HOLD",
        reason: evaluated.map((e) => `${e.met ? "✓" : "✗"}${e.label}`).join(" "),
      };
    }
    return { signal: "BUY", reason: evaluated.map((e) => e.label).join("+") };
  };
}

/** 태그(해시태그) 조합 커스텀 매도 조건 판정용 개별 체크 함수 모음 (다른 트레이더들이 참고하는 지표 다수 포함) */
const SELL_TAG_CHECKS: Record<string, (rows: IndicatorRow[], avgBuyPrice: number) => boolean> = {
  "sell-stop-loss-20": (rows, avg) => {
    const c = rows.at(-1)!;
    return ((c.close - avg) / avg) * 100 <= STOP_LOSS_PCT;
  },
  "sell-take-profit-15": (rows, avg) => {
    const c = rows.at(-1)!;
    return ((c.close - avg) / avg) * 100 >= TAKE_PROFIT_PCT;
  },
  "sell-profit-range-7to15": (rows, avg) => {
    const c = rows.at(-1)!;
    const pct = ((c.close - avg) / avg) * 100;
    return pct >= TAKE_PROFIT_RANGE_MIN && pct <= TAKE_PROFIT_PCT;
  },
  "sell-ma20-slope-turn-negative": (rows) => ma20SlopeTurnedNegative(rows),
  "sell-dead-cross": (rows) => deadCrossJustHappened(rows),
  "sell-macd-hist-negative-turn": (rows) => macdHistTurnedNegative(rows),
  "sell-macd-below-zero": (rows) => rows.at(-1)!.macd <= 0,
  "sell-rsi-overbought-exit": (rows) => rsiExitFromOverbought(rows, RSI_REBOUND_WINDOW, 70),
  "sell-bollinger-upper-break-back": (rows) => bollingerUpperTouchThenBack(rows, RSI_REBOUND_WINDOW),
  "sell-bollinger-lower-break": (rows) => bollingerLowerBreak(rows),
  "sell-ichimoku-close-below-cloud": (rows) => closeBelowCloud(rows),
  "sell-ichimoku-dead-cross": (rows) => tenkanCrossedDownKijun(rows),
  "sell-volume-climax": (rows) => volumeClimaxDown(rows),
};

/** RSI 과매도 이탈복귀 임계값을 파라미터로 받는 매수 조건 체크 (전략 최적화 탐색용) */
export function buildRsiReboundCheck(threshold: number): (rows: IndicatorRow[]) => boolean {
  return (rows: IndicatorRow[]) => rsiReboundFromOversold(rows, RSI_REBOUND_WINDOW, threshold);
}

/** RSI 과매수 이탈 임계값을 파라미터로 받는 매도 조건 체크 (전략 최적화 탐색용) */
export function buildRsiOverboughtExitCheck(threshold: number): (rows: IndicatorRow[]) => boolean {
  return (rows: IndicatorRow[]) => rsiExitFromOverbought(rows, RSI_REBOUND_WINDOW, threshold);
}

/**
 * 사용자가 선택한 매도 조건 태그 조합을 OR로 판정 (하나라도 충족하면 SELL).
 * 선택된 태그가 없으면 항상 HOLD (자동 매도하지 않음).
 */
export function checkCustomSellSignal(
  tagIds: string[],
): (rows: IndicatorRow[], avgBuyPrice: number) => SignalResult {
  return (rows: IndicatorRow[], avgBuyPrice: number): SignalResult => {
    const cur = rows.at(-1)!;
    const changePct = ((cur.close - avgBuyPrice) / avgBuyPrice) * 100;

    if (tagIds.length === 0) {
      return { signal: "HOLD", reason: `선택된 매도 조건 없음 (${changePct.toFixed(1)}%)` };
    }

    const labelOf = (id: string) => SELL_TAG_META.find((t) => t.id === id)?.label ?? id;
    const evaluated = tagIds.map((id) => ({
      id,
      label: labelOf(id),
      met: SELL_TAG_CHECKS[id] ? SELL_TAG_CHECKS[id](rows, avgBuyPrice) : false,
    }));

    const metOnes = evaluated.filter((e) => e.met);
    if (metOnes.length === 0) {
      return { signal: "HOLD", reason: `보유 유지 (${changePct.toFixed(1)}%)` };
    }
    return {
      signal: "SELL",
      reason: `${metOnes.map((e) => e.label).join(" / ")} (${changePct.toFixed(1)}%)`,
    };
  };
}
