import { ACCOUNT_NO, BASE_URL, MOCK } from "./config";
import { getHeaders } from "./kisAuth";

const ORDER_PATH = "/uapi/domestic-stock/v1/trading/order";

// 모의투자/실전투자 tr_id 분기 (매수/매도)
const BUY_TR_ID = MOCK ? "VTTC0802U" : "TTTC0802U";
const SELL_TR_ID = MOCK ? "VTTC0801U" : "TTTC0801U";

function splitAccountNo() {
  const [cano, acntPrdtCd] = ACCOUNT_NO.split("-");
  return { cano, acntPrdtCd };
}

export interface OrderResult {
  success: boolean;
  orderNo?: string;
  message: string;
}

/** 시장가 매수/매도 주문 실행 */
async function placeMarketOrder(
  stockCode: string,
  qty: number,
  side: "BUY" | "SELL",
): Promise<OrderResult> {
  const { cano, acntPrdtCd } = splitAccountNo();
  const trId = side === "BUY" ? BUY_TR_ID : SELL_TR_ID;

  const body = {
    CANO: cano,
    ACNT_PRDT_CD: acntPrdtCd,
    PDNO: stockCode,
    ORD_DVSN: "01", // 01: 시장가
    ORD_QTY: String(qty),
    ORD_UNPR: "0",
  };

  const res = await fetch(`${BASE_URL}${ORDER_PATH}`, {
    method: "POST",
    headers: await getHeaders(trId),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.rt_cd !== "0") {
    return { success: false, message: data.msg1 ?? `주문 실패(${res.status})` };
  }

  return {
    success: true,
    orderNo: data.output?.ODNO,
    message: data.msg1 ?? "주문 성공",
  };
}

export function buyMarketOrder(stockCode: string, qty: number) {
  return placeMarketOrder(stockCode, qty, "BUY");
}

export function sellMarketOrder(stockCode: string, qty: number) {
  return placeMarketOrder(stockCode, qty, "SELL");
}
