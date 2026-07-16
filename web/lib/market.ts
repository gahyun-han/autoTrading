import { BASE_URL, UNIVERSE_SIZE } from "./config";
import { getHeaders } from "./kisAuth";
import type { Candle } from "./indicators";

const DAILY_CHART_TR_ID = "FHKST03010100";
const DAILY_CHART_PATH = "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice";

// 국내주식 시가총액 상위 조회 (KIS 랭킹 API)
// NOTE: tr_id/파라미터는 KIS 공식 문서 기준으로 재검증 필요 (실제 키 발급 후 sandbox에서 확인)
const MARKET_CAP_RANK_TR_ID = "FHPST01740000";
const MARKET_CAP_RANK_PATH = "/uapi/domestic-stock/v1/ranking/market-cap";

/** 일봉 OHLCV 조회 (날짜 오름차순) */
export async function fetchDailyOhlcv(
  stockCode: string,
  startDate: string,
  endDate: string,
): Promise<Candle[]> {
  const url = new URL(`${BASE_URL}${DAILY_CHART_PATH}`);
  url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
  url.searchParams.set("FID_INPUT_ISCD", stockCode);
  url.searchParams.set("FID_INPUT_DATE_1", startDate);
  url.searchParams.set("FID_INPUT_DATE_2", endDate);
  url.searchParams.set("FID_PERIOD_DIV_CODE", "D");
  url.searchParams.set("FID_ORG_ADJ_PRC", "0");

  const res = await fetch(url, { headers: await getHeaders(DAILY_CHART_TR_ID) });
  if (!res.ok) throw new Error(`일봉 조회 실패(${stockCode}): ${res.status}`);
  const data = await res.json();

  const rows: any[] = data.output2 ?? [];
  const candles: Candle[] = rows.map((r) => ({
    date: r.stck_bsop_date,
    open: Number(r.stck_oprc),
    high: Number(r.stck_hgpr),
    low: Number(r.stck_lwpr),
    close: Number(r.stck_clpr),
    volume: Number(r.acml_vol),
  }));

  return candles.sort((a, b) => a.date.localeCompare(b.date));
}

export interface UniverseStock {
  code: string;
  name: string;
  marketCap: number;
}

/**
 * 코스피/코스닥 시가총액 상위 N개 종목 조회
 * 시장 구분(FID_COND_MRKT_DIV_CODE)을 코스피(J)/코스닥(Q) 각각 호출 후 시가총액 기준으로 합쳐서 상위 N개를 반환한다.
 */
export async function fetchTopMarketCapUniverse(
  size: number = UNIVERSE_SIZE,
): Promise<UniverseStock[]> {
  const markets = ["J", "Q"]; // J: 코스피, Q: 코스닥
  const all: UniverseStock[] = [];

  for (const marketCode of markets) {
    const url = new URL(`${BASE_URL}${MARKET_CAP_RANK_PATH}`);
    url.searchParams.set("fid_cond_mrkt_div_code", marketCode);
    url.searchParams.set("fid_cond_scr_div_code", "20174");
    url.searchParams.set("fid_div_cls_code", "0");
    url.searchParams.set("fid_input_iscd", "0000");
    url.searchParams.set("fid_trgt_cls_code", "0");
    url.searchParams.set("fid_trgt_exls_cls_code", "0");
    url.searchParams.set("fid_input_price_1", "");
    url.searchParams.set("fid_input_price_2", "");
    url.searchParams.set("fid_vol_cnt", "");

    const res = await fetch(url, { headers: await getHeaders(MARKET_CAP_RANK_TR_ID) });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`시가총액 순위 조회 실패(${marketCode}): ${res.status} ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const rows: any[] = data.output ?? [];

    for (const r of rows) {
      all.push({
        code: r.mksc_shrn_iscd ?? r.stck_shrn_iscd,
        name: r.hts_kor_isnm,
        marketCap: Number(r.stck_avls ?? r.acc_trdvol ?? 0),
      });
    }

    // KIS API 호출 제한 대응 (초당 20건)
    await new Promise((r) => setTimeout(r, 1000));
  }

  return all.sort((a, b) => b.marketCap - a.marketCap).slice(0, size);
}
