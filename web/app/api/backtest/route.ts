import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";
import { INVEST_PER_STOCK } from "@/lib/config";
import { calculateIndicators } from "@/lib/indicators";
import { fetchDailyOhlcv } from "@/lib/market";
import { PRESET_DEFAULT, SELL_PRESET_DEFAULT } from "@/lib/conditionTags";
import { PRESET_STOCKS, type PresetStock } from "@/lib/presetStocks";
import { checkCustomBuySignal, checkCustomSellSignal } from "@/lib/strategy";

export const maxDuration = 60;

function parseTargets(stocksParam: string | null): PresetStock[] {
  if (!stocksParam) return PRESET_STOCKS;
  try {
    const parsed = JSON.parse(stocksParam);
    if (!Array.isArray(parsed)) return PRESET_STOCKS;
    const targets = parsed
      .filter((s): s is PresetStock => s && typeof s.code === "string" && /^\d{6}$/.test(s.code))
      .map((s) => ({ code: s.code, name: (typeof s.name === "string" && s.name.trim()) || s.code }));
    return targets.length > 0 ? targets : PRESET_STOCKS;
  } catch {
    return PRESET_STOCKS;
  }
}

function fmt(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : PRESET_DEFAULT;
  const buySignalFn = checkCustomBuySignal(tags);
  const sellTagsParam = searchParams.get("sellTags");
  const sellTags = sellTagsParam ? sellTagsParam.split(",").filter(Boolean) : SELL_PRESET_DEFAULT;
  const sellSignalFn = checkCustomSellSignal(sellTags);
  const targets = parseTargets(searchParams.get("stocks"));

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 200); // KIS 일봉 API는 요청 범위와 무관하게 최근 100거래일(약 4~5개월)까지만 반환

  const results = [];
  for (const t of targets) {
    try {
      const candles = await fetchDailyOhlcv(t.code, fmt(start), fmt(end));
      const rows = calculateIndicators(candles);
      // KIS가 실제로 반환한 전체 기간(최대 100거래일)을 그대로 시뮬레이션 대상으로 사용
      results.push(
        runBacktest(
          t.code,
          t.name,
          rows,
          rows[0]?.date ?? fmt(start),
          INVEST_PER_STOCK,
          buySignalFn,
          sellSignalFn,
        ),
      );
    } catch (e: any) {
      results.push({ stockCode: t.code, stockName: t.name, error: e.message });
    }
    await sleep(500); // KIS 호출 제한 대응
  }

  return NextResponse.json({
    tags,
    sellTags,
    dataStart: fmt(start),
    dataEnd: fmt(end),
    results,
    ranAt: new Date().toISOString(),
  });
}
