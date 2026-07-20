import type { IndicatorRow } from "./indicators";
import { checkBuySignal, checkSellSignal, type SignalResult } from "./strategy";

export interface BacktestTrade {
  date: string; // YYYYMMDD
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  reason: string;
}

export interface BacktestCandle {
  date: string; // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
  ma5: number;
  ma20: number;
  ma60: number;
  ma120: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  tenkan: number;
  kijun: number;
  spanA: number;
  spanB: number;
}

export interface BacktestResult {
  stockCode: string;
  stockName: string;
  trades: BacktestTrade[];
  invested: number;
  finalValue: number;
  finalReturnPct: number;
  candles: BacktestCandle[];
}

/**
 * 지정한 시작일부터 마지막 봉까지, 시뮬레이션 시점까지의 데이터만 사용해
 * (미래 데이터 참조 없이) 실제 매수/매도 전략을 그대로 재현한다.
 */
export function runBacktest(
  stockCode: string,
  stockName: string,
  rows: IndicatorRow[],
  backtestStartDate: string,
  investPerStock: number,
  buySignalFn: (rows: IndicatorRow[]) => SignalResult = checkBuySignal,
  sellSignalFn: (rows: IndicatorRow[], avgBuyPrice: number) => SignalResult = checkSellSignal,
): BacktestResult {
  const trades: BacktestTrade[] = [];
  let cash = investPerStock;
  let qty = 0;
  let avgPrice = 0;

  const startIdx = rows.findIndex((r) => r.date >= backtestStartDate);
  const simStart = startIdx === -1 ? rows.length : startIdx;

  for (let i = simStart; i < rows.length; i++) {
    const upToNow = rows.slice(0, i + 1);
    const today = rows[i];

    if (qty > 0) {
      const result = sellSignalFn(upToNow, avgPrice);
      if (result.signal === "SELL") {
        cash += qty * today.close;
        trades.push({ date: today.date, side: "SELL", price: today.close, qty, reason: result.reason });
        qty = 0;
        avgPrice = 0;
      }
    } else {
      const result = buySignalFn(upToNow);
      if (result.signal === "BUY") {
        const buyQty = Math.floor(cash / today.close);
        if (buyQty > 0) {
          cash -= buyQty * today.close;
          qty = buyQty;
          avgPrice = today.close;
          trades.push({ date: today.date, side: "BUY", price: today.close, qty: buyQty, reason: result.reason });
        }
      }
    }
  }

  const lastPrice = rows.at(-1)?.close ?? 0;
  const finalValue = cash + qty * lastPrice;
  const finalReturnPct = ((finalValue - investPerStock) / investPerStock) * 100;

  const candles: BacktestCandle[] = rows.slice(simStart).map((r) => ({
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    ma5: r.ma5,
    ma20: r.ma20,
    ma60: r.ma60,
    ma120: r.ma120,
    rsi: r.rsi,
    macd: r.macd,
    macdSignal: r.macdSignal,
    macdHist: r.macdHist,
    tenkan: r.tenkan,
    kijun: r.kijun,
    spanA: r.spanA,
    spanB: r.spanB,
  }));

  return { stockCode, stockName, trades, invested: investPerStock, finalValue, finalReturnPct, candles };
}
