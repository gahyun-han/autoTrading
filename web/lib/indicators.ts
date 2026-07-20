import { MACD_FAST, MACD_SIGNAL, MACD_SLOW, MA_LONG, MA_SHORT } from "./config";

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
  rsi: number;
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

/** 일봉(오름차순) 배열에 MACD, MA5/MA20 지표를 계산해 붙인다 */
export function calculateIndicators(candles: Candle[]): IndicatorRow[] {
  const closes = candles.map((c) => c.close);

  const emaFast = ema(closes, MACD_FAST);
  const emaSlow = ema(closes, MACD_SLOW);
  const macd = emaFast.map((v, i) => v - emaSlow[i]);
  const macdSignal = ema(macd, MACD_SIGNAL);
  const macdHist = macd.map((v, i) => v - macdSignal[i]);

  const ma5 = sma(closes, MA_SHORT);
  const ma20 = sma(closes, MA_LONG);
  const rsiValues = rsi(closes);

  return candles.map((c, i) => ({
    ...c,
    macd: macd[i],
    macdSignal: macdSignal[i],
    macdHist: macdHist[i],
    ma5: ma5[i],
    ma20: ma20[i],
    rsi: rsiValues[i],
  }));
}
