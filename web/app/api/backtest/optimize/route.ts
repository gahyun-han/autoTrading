import { NextResponse } from "next/server";
import { INVEST_PER_STOCK } from "@/lib/config";
import { calculateIndicators } from "@/lib/indicators";
import { fetchDailyOhlcv } from "@/lib/market";
import { runOptimization, type StockDataset } from "@/lib/optimize";

export const maxDuration = 60;

const TARGETS = [
  { code: "494310", name: "KODEX반도체레버리지" },
  { code: "233740", name: "KODEX코스닥150레버리지" },
  { code: "005930", name: "삼성전자" },
  { code: "000660", name: "SK하이닉스" },
  { code: "035420", name: "NAVER" },
];

function fmt(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 200);

  const datasets: StockDataset[] = [];
  const fetchErrors: { stockCode: string; stockName: string; error: string }[] = [];

  for (const t of TARGETS) {
    try {
      const candles = await fetchDailyOhlcv(t.code, fmt(start), fmt(end));
      const rows = calculateIndicators(candles);
      datasets.push({
        stockCode: t.code,
        stockName: t.name,
        rows,
        backtestStartDate: rows[0]?.date ?? fmt(start),
        investPerStock: INVEST_PER_STOCK,
      });
    } catch (e: any) {
      fetchErrors.push({ stockCode: t.code, stockName: t.name, error: e.message });
    }
    await sleep(500); // KIS 호출 제한 대응
  }

  if (datasets.length === 0) {
    return NextResponse.json({ error: "데이터를 조회하지 못했습니다", fetchErrors }, { status: 500 });
  }

  const report = runOptimization(datasets);

  return NextResponse.json({
    ...report,
    fetchErrors,
    dataStart: fmt(start),
    dataEnd: fmt(end),
    ranAt: new Date().toISOString(),
  });
}
