import { ensureSchema, sql } from "./db";
import type { IndicatorRow } from "./indicators";

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
  reason: string | null;
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

/**
 * 특정 종목의 signal_log가 비어있으면(최초 스캔) 최근 15일치 지표를
 * 실제 날짜로 소급 삽입해 차트가 처음부터 추세선을 보여주도록 한다.
 * (오늘자 로그는 호출부에서 별도로 insert하므로 마지막 1일은 제외)
 */
export async function backfillSignalHistory(
  stockCode: string,
  stockName: string,
  rows: IndicatorRow[],
  days = 15,
) {
  try {
    await ensureSchema();
    const existing = await sql`SELECT 1 FROM signal_log WHERE stock_code = ${stockCode} LIMIT 1`;
    if (existing.length > 0) return;

    const historyRows = rows.slice(-days, -1);
    for (const r of historyRows) {
      const isoDate = `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`;
      await sql`
        INSERT INTO signal_log (stock_code, stock_name, macd, macd_signal, macd_hist, ma5, ma20, signal, created_at)
        VALUES (${stockCode}, ${stockName}, ${r.macd}, ${r.macdSignal}, ${r.macdHist}, ${r.ma5}, ${r.ma20}, 'HISTORY', ${isoDate}::date)
      `;
    }
  } catch {
    // 백필 실패는 무시 (오늘자 정상 로그 삽입에는 영향 없음)
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

/** 종목별 가장 최근 스캔에서 매수(BUY) 시그널이 뜬, 현재 매매 후보 종목 목록 */
export async function getBuyCandidates(limit = 20): Promise<SignalRow[]> {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT DISTINCT ON (stock_code) *
      FROM signal_log
      WHERE signal = 'BUY'
      ORDER BY stock_code, created_at DESC
    `;
    return (rows as unknown as SignalRow[])
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  } catch {
    return [];
  }
}
