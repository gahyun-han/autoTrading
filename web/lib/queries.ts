import { ensureSchema, sql } from "./db";

export interface TradeRow {
  id: number;
  stock_code: string;
  stock_name: string | null;
  side: "BUY" | "SELL";
  qty: number;
  price: string;
  reason: string | null;
  order_no: string | null;
  created_at: string;
}

export interface PositionRow {
  stock_code: string;
  stock_name: string | null;
  qty: number;
  avg_price: string;
  updated_at: string;
}

export interface SignalRow {
  id: number;
  stock_code: string;
  stock_name: string | null;
  macd: string;
  macd_signal: string;
  macd_hist: string;
  ma5: string;
  ma20: string;
  signal: string;
  created_at: string;
}

export async function getRecentTrades(limit = 50): Promise<TradeRow[]> {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT * FROM trades ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows as unknown as TradeRow[];
  } catch {
    return [];
  }
}

export async function getPositions(): Promise<PositionRow[]> {
  try {
    await ensureSchema();
    const rows = await sql`SELECT * FROM positions ORDER BY updated_at DESC`;
    return rows as unknown as PositionRow[];
  } catch {
    return [];
  }
}

/** signal_log에 기록된 종목 코드 목록 (최근 활동 순) */
export async function getTrackedStockCodes(limit = 20): Promise<
  { stock_code: string; stock_name: string | null }[]
> {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT DISTINCT ON (stock_code) stock_code, stock_name, created_at
      FROM signal_log
      ORDER BY stock_code, created_at DESC
    `;
    return (rows as any[])
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
      .map((r) => ({ stock_code: r.stock_code, stock_name: r.stock_name }));
  } catch {
    return [];
  }
}

export async function getSignalHistory(
  stockCode: string,
  limit = 200,
): Promise<SignalRow[]> {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT * FROM signal_log
      WHERE stock_code = ${stockCode}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    return rows as unknown as SignalRow[];
  } catch {
    return [];
  }
}
