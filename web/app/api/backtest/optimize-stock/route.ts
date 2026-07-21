import { NextResponse } from "next/server";
import { INVEST_PER_STOCK } from "@/lib/config";
import { calculateIndicators } from "@/lib/indicators";
import { fetchDailyOhlcv } from "@/lib/market";
import { runOptimization, type StockDataset } from "@/lib/optimize";

export const maxDuration = 60;

function fmt(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** 종목코드 하나를 입력받아 해당 종목만 대상으로 매수/매도 조합·RSI 임계값 최적화를 실행 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "").trim();
  const name = (searchParams.get("name") ?? "").trim() || code;

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "종목코드는 6자리 숫자여야 합니다 (예: 005930)" }, { status: 400 });
  }

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 200); // KIS 일봉 API는 요청 범위와 무관하게 최근 100거래일까지만 반환

  let dataset: StockDataset;
  try {
    const candles = await fetchDailyOhlcv(code, fmt(start), fmt(end));
    if (candles.length < 30) {
      return NextResponse.json(
        { error: `백테스트에 필요한 데이터가 부족합니다 (${candles.length}개 봉, 최소 30개 필요)` },
        { status: 400 },
      );
    }
    const rows = calculateIndicators(candles);
    dataset = {
      stockCode: code,
      stockName: name,
      rows,
      backtestStartDate: rows[0]?.date ?? fmt(start),
      investPerStock: INVEST_PER_STOCK,
    };
  } catch (e: any) {
    return NextResponse.json({ error: `일봉 조회 실패(${code}): ${e.message}` }, { status: 500 });
  }

  const report = runOptimization([dataset]);

  return NextResponse.json({
    ...report,
    dataStart: fmt(start),
    dataEnd: fmt(end),
    ranAt: new Date().toISOString(),
  });
}
