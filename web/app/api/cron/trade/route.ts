import { NextResponse } from "next/server";
import { INVEST_PER_STOCK, MAX_POSITION } from "@/lib/config";
import { ensureSchema, sql } from "@/lib/db";
import { calculateIndicators } from "@/lib/indicators";
import { fetchDailyOhlcv, fetchTopMarketCapUniverse } from "@/lib/market";
import { buyMarketOrder, sellMarketOrder } from "@/lib/order";
import { backfillSignalHistory } from "@/lib/queries";
import { checkBuySignal, checkSellSignal } from "@/lib/strategy";

export const maxDuration = 300; // 종목 스캔에 시간이 걸릴 수 있어 넉넉히 설정

function dateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 120); // MACD(26)+시그널(9) 계산에 필요한 여유 기간
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: Request) {
  // Vercel Cron 요청 검증 (CRON_SECRET 설정 시)
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const { start, end } = dateRange();

  const bought: string[] = [];
  const sold: string[] = [];
  const errors: string[] = [];

  // 1. 보유 종목 매도 시그널 체크
  const positions = await sql`SELECT stock_code, stock_name, qty, avg_price FROM positions`;

  for (const pos of positions as any[]) {
    try {
      const candles = await fetchDailyOhlcv(pos.stock_code, start, end);
      const rows = calculateIndicators(candles);
      const result = checkSellSignal(rows, Number(pos.avg_price));

      await backfillSignalHistory(pos.stock_code, pos.stock_name, rows);

      await sql`
        INSERT INTO signal_log (stock_code, stock_name, macd, macd_signal, macd_hist, ma5, ma20, signal, reason)
        VALUES (${pos.stock_code}, ${pos.stock_name}, ${rows.at(-1)!.macd}, ${rows.at(-1)!.macdSignal},
                ${rows.at(-1)!.macdHist}, ${rows.at(-1)!.ma5}, ${rows.at(-1)!.ma20}, ${result.signal}, ${result.reason})
      `;

      if (result.signal === "SELL") {
        const order = await sellMarketOrder(pos.stock_code, pos.qty);
        if (order.success) {
          await sql`
            INSERT INTO trades (stock_code, stock_name, side, qty, price, reason, order_no)
            VALUES (${pos.stock_code}, ${pos.stock_name}, 'SELL', ${pos.qty}, ${rows.at(-1)!.close}, ${result.reason}, ${order.orderNo})
          `;
          await sql`DELETE FROM positions WHERE stock_code = ${pos.stock_code}`;
          sold.push(pos.stock_code);
        } else {
          errors.push(`매도 실패 ${pos.stock_code}: ${order.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`매도 체크 실패 ${pos.stock_code}: ${e.message}`);
    }
    await sleep(500); // KIS 호출 제한 대응
  }

  // 2. 신규 매수 시그널 스캔 (최대 보유 수 미만일 때만)
  const remainingSlots = MAX_POSITION - (positions.length - sold.length);
  if (remainingSlots > 0) {
    try {
      const universe = await fetchTopMarketCapUniverse();
      const heldCodes = new Set(
        (positions as any[]).filter((p) => !sold.includes(p.stock_code)).map((p) => p.stock_code),
      );

      let slotsLeft = remainingSlots;
      for (const stock of universe) {
        if (slotsLeft <= 0) break;
        if (heldCodes.has(stock.code)) continue;

        try {
          const candles = await fetchDailyOhlcv(stock.code, start, end);
          const rows = calculateIndicators(candles);
          const result = checkBuySignal(rows);

          await backfillSignalHistory(stock.code, stock.name, rows);

          await sql`
            INSERT INTO signal_log (stock_code, stock_name, macd, macd_signal, macd_hist, ma5, ma20, signal, reason)
            VALUES (${stock.code}, ${stock.name}, ${rows.at(-1)!.macd}, ${rows.at(-1)!.macdSignal},
                    ${rows.at(-1)!.macdHist}, ${rows.at(-1)!.ma5}, ${rows.at(-1)!.ma20}, ${result.signal}, ${result.reason})
          `;

          if (result.signal === "BUY") {
            const price = rows.at(-1)!.close;
            const qty = Math.floor(INVEST_PER_STOCK / price);
            if (qty > 0) {
              const order = await buyMarketOrder(stock.code, qty);
              if (order.success) {
                await sql`
                  INSERT INTO trades (stock_code, stock_name, side, qty, price, reason, order_no)
                  VALUES (${stock.code}, ${stock.name}, 'BUY', ${qty}, ${price}, ${result.reason}, ${order.orderNo})
                `;
                await sql`
                  INSERT INTO positions (stock_code, stock_name, qty, avg_price)
                  VALUES (${stock.code}, ${stock.name}, ${qty}, ${price})
                  ON CONFLICT (stock_code) DO UPDATE SET qty = EXCLUDED.qty, avg_price = EXCLUDED.avg_price
                `;
                bought.push(stock.code);
                slotsLeft--;
              } else {
                errors.push(`매수 실패 ${stock.code}: ${order.message}`);
              }
            }
          }
        } catch (e: any) {
          errors.push(`매수 체크 실패 ${stock.code}: ${e.message}`);
        }
        await sleep(500);
      }
    } catch (e: any) {
      errors.push(`유니버스 조회 실패: ${e.message}`);
    }
  }

  return NextResponse.json({ bought, sold, errors, ranAt: new Date().toISOString() });
}
