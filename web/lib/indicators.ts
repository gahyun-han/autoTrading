import {
  ADX_PERIOD,
  BB_PERIOD,
  BB_STDDEV_MULT,
  ICHIMOKU_BASE,
  ICHIMOKU_CONVERSION,
  ICHIMOKU_SPAN_B,
  MACD_FAST,
  MACD_SIGNAL,
  MACD_SLOW,
  MA_LONG,
  MA_MID,
  MA_SHORT,
  MA_XLONG,
  OBV_LONG,
  OBV_SHORT,
  STOCH_PERIOD,
  STOCH_SMOOTH_D,
  STOCH_SMOOTH_K,
} from "./config";

export interface Candle {
  date: string; // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorRow extends Candle {
  macd: number;
  macdSignal: number;
  macdHist: number;
  ma5: number;
  ma20: number;
  ma60: number;
  ma120: number;
  rsi: number;
  tenkan: number; // 일목균형표 전환선
  kijun: number; // 일목균형표 기준선
  spanA: number; // 일목균형표 선행스팬1 ((전환선+기준선)/2)
  spanB: number; // 일목균형표 선행스팬2 (52일 최고/최저 중간값)
  bbMid: number; // 볼린저밴드 중심선 (20일 SMA)
  bbUpper: number; // 볼린저밴드 상단 (중심선 + 2*표준편차)
  bbLower: number; // 볼린저밴드 하단 (중심선 - 2*표준편차)
  stochK: number; // 스토캐스틱 %K (3일 평활)
  stochD: number; // 스토캐스틱 %D (%K의 3일 평활)
  obv: number; // On-Balance Volume 누적값
  obvSma5: number; // OBV 5일 이동평균
  obvSma20: number; // OBV 20일 이동평균
  adx: number; // 추세강도(Average Directional Index)
}

function ema(values: number[], span: number): number[] {
  const k = 2 / (span + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI */
function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += -diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function sma(values: number[], window: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : NaN);
  }
  return out;
}

/** 볼린저밴드: N일 SMA 중심선 ± (표준편차 * mult) 상/하단 */
function bollingerBands(closes: number[], period: number, mult: number) {
  const mid = sma(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { mid, upper, lower };
}

/** NaN이 섞인 배열에서도 안전하게(윈도우 내 NaN이 있으면 NaN 반환) 계산하는 이동평균 */
function smaSafe(values: number[], window: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  for (let i = window - 1; i < values.length; i++) {
    let sum = 0;
    let ok = true;
    for (let j = i - window + 1; j <= i; j++) {
      if (Number.isNaN(values[j])) {
        ok = false;
        break;
      }
      sum += values[j];
    }
    out[i] = ok ? sum / window : NaN;
  }
  return out;
}

/** 스토캐스틱: %K = (종가-N일최저)/(N일최고-N일최저)*100, %K/%D는 각각 smoothK/smoothD일 평활 */
function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number,
  smoothK: number,
  smoothD: number,
) {
  const rawK: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    rawK[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
  }
  const k = smaSafe(rawK, smoothK);
  const d = smaSafe(k, smoothD);
  return { k, d };
}

/** On-Balance Volume: 종가 상승일엔 거래량 가산, 하락일엔 거래량 감산 (거래량-가격 동반확인용) */
function calcObv(closes: number[], volumes: number[]): number[] {
  const out: number[] = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) out[i] = out[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) out[i] = out[i - 1] - volumes[i];
    else out[i] = out[i - 1];
  }
  return out;
}

/** ADX(추세강도): Wilder 평활을 사용한 +DI/-DI 기반 추세강도 지표 (0~100, 통상 25 이상이면 추세 구간) */
function calcAdx(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const n = highs.length;
  const adxOut: number[] = new Array(n).fill(NaN);
  if (n < period * 2) return adxOut;

  const tr: number[] = new Array(n).fill(0);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }

  let smTR = 0;
  let smPlusDM = 0;
  let smMinusDM = 0;
  for (let i = 1; i <= period; i++) {
    smTR += tr[i];
    smPlusDM += plusDM[i];
    smMinusDM += minusDM[i];
  }

  const dx: number[] = new Array(n).fill(NaN);
  const plusDI0 = smTR === 0 ? 0 : (100 * smPlusDM) / smTR;
  const minusDI0 = smTR === 0 ? 0 : (100 * smMinusDM) / smTR;
  dx[period] = plusDI0 + minusDI0 === 0 ? 0 : (100 * Math.abs(plusDI0 - minusDI0)) / (plusDI0 + minusDI0);

  for (let i = period + 1; i < n; i++) {
    smTR = smTR - smTR / period + tr[i];
    smPlusDM = smPlusDM - smPlusDM / period + plusDM[i];
    smMinusDM = smMinusDM - smMinusDM / period + minusDM[i];
    const plusDI = smTR === 0 ? 0 : (100 * smPlusDM) / smTR;
    const minusDI = smTR === 0 ? 0 : (100 * smMinusDM) / smTR;
    dx[i] = plusDI + minusDI === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
  }

  let dxSum = 0;
  for (let i = period; i < period * 2; i++) dxSum += dx[i];
  adxOut[period * 2 - 1] = dxSum / period;
  for (let i = period * 2; i < n; i++) {
    adxOut[i] = (adxOut[i - 1] * (period - 1) + dx[i]) / period;
  }
  return adxOut;
}

/** 최근 window 기간의 (최고가+최저가)/2 (일목균형표 전환선/기준선/스팬2 계산용) */
function midpointHighLow(highs: number[], lows: number[], window: number): number[] {
  const out: number[] = new Array(highs.length).fill(NaN);
  for (let i = window - 1; i < highs.length; i++) {
    let max = -Infinity;
    let min = Infinity;
    for (let j = i - window + 1; j <= i; j++) {
      if (highs[j] > max) max = highs[j];
      if (lows[j] < min) min = lows[j];
    }
    out[i] = (max + min) / 2;
  }
  return out;
}

/** 일봉(오름차순) 배열에 MACD, MA, RSI, 일목균형표 지표를 계산해 붙인다 */
export function calculateIndicators(candles: Candle[]): IndicatorRow[] {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  const emaFast = ema(closes, MACD_FAST);
  const emaSlow = ema(closes, MACD_SLOW);
  const macd = emaFast.map((v, i) => v - emaSlow[i]);
  const macdSignal = ema(macd, MACD_SIGNAL);
  const macdHist = macd.map((v, i) => v - macdSignal[i]);

  const ma5 = sma(closes, MA_SHORT);
  const ma20 = sma(closes, MA_LONG);
  const ma60 = sma(closes, MA_MID);
  const ma120 = sma(closes, MA_XLONG);
  const rsiValues = rsi(closes);

  const tenkan = midpointHighLow(highs, lows, ICHIMOKU_CONVERSION);
  const kijun = midpointHighLow(highs, lows, ICHIMOKU_BASE);
  const spanA = tenkan.map((v, i) => (Number.isNaN(v) || Number.isNaN(kijun[i]) ? NaN : (v + kijun[i]) / 2));
  const spanB = midpointHighLow(highs, lows, ICHIMOKU_SPAN_B);
  const bb = bollingerBands(closes, BB_PERIOD, BB_STDDEV_MULT);
  const stoch = stochastic(highs, lows, closes, STOCH_PERIOD, STOCH_SMOOTH_K, STOCH_SMOOTH_D);
  const obv = calcObv(closes, volumes);
  const obvSma5 = smaSafe(obv, OBV_SHORT);
  const obvSma20 = smaSafe(obv, OBV_LONG);
  const adxValues = calcAdx(highs, lows, closes, ADX_PERIOD);

  return candles.map((c, i) => ({
    ...c,
    macd: macd[i],
    macdSignal: macdSignal[i],
    macdHist: macdHist[i],
    ma5: ma5[i],
    ma20: ma20[i],
    ma60: ma60[i],
    ma120: ma120[i],
    rsi: rsiValues[i],
    tenkan: tenkan[i],
    kijun: kijun[i],
    spanA: spanA[i],
    spanB: spanB[i],
    bbMid: bb.mid[i],
    bbUpper: bb.upper[i],
    bbLower: bb.lower[i],
    stochK: stoch.k[i],
    stochD: stoch.d[i],
    obv: obv[i],
    obvSma5: obvSma5[i],
    obvSma20: obvSma20[i],
    adx: adxValues[i],
  }));
}
