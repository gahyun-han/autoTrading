import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";
import { INVEST_PER_STOCK } from "@/lib/config";
import { calculateIndicators } from "@/lib/indicators";
import { fetchDailyOhlcv } from "@/lib/market";

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
  start.setDate(end.getDate() - 200); // KIS 일봉 API는 요청 범위와 무관하게 최근 100거래일(약 4~5개월)까지만 반환

  const results = [];
  for (const t of TARGETS) {
    try {
      const candles = await fetchDailyOhlcv(t.code, fmt(start), fmt(end));
      const rows = calculateIndicators(candles);
      // KIS가 실제로 반환한 전체 기간(최대 100거래일)을 그대로 시뮬레이션 대상으로 사용
      results.push(runBacktest(t.code, t.name, rows, rows[0]?.date ?? fmt(start), INVEST_PER_STOCK));
    } catch (e: any) {
      results.push({ stockCode: t.code, stockName: t.name, error: e.message });
    }
    await sleep(500); // KIS 호출 제한 대응
  }

  return NextResponse.json({
    dataStart: fmt(start),
    dataEnd: fmt(end),
    results,
    ranAt: new Date().toISOString(),
  });
}
