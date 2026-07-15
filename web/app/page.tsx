import MacdChart from "@/components/MacdChart";
import { getPositions, getRecentTrades, getSignalHistory, getTrackedStockCodes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  const [trades, positions, trackedStocks] = await Promise.all([
    getRecentTrades(50),
    getPositions(),
    getTrackedStockCodes(20),
  ]);

  const selectedCode = code ?? trackedStocks[0]?.stock_code;
  const signalHistory = selectedCode ? await getSignalHistory(selectedCode) : [];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-200 p-8 font-sans">
      <h1 className="text-2xl font-bold mb-6">autoTrading 대시보드</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">보유 포지션 ({positions.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="p-2 text-left">종목코드</th>
                <th className="p-2 text-left">종목명</th>
                <th className="p-2 text-right">수량</th>
                <th className="p-2 text-right">평단가</th>
                <th className="p-2 text-right">갱신시각</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.stock_code} className="border-t border-gray-800">
                  <td className="p-2">{p.stock_code}</td>
                  <td className="p-2">{p.stock_name}</td>
                  <td className="p-2 text-right">{p.qty}</td>
                  <td className="p-2 text-right">{Number(p.avg_price).toLocaleString()}</td>
                  <td className="p-2 text-right text-gray-500">
                    {new Date(p.updated_at).toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))}
              {positions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    보유 종목 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">매매 체결 로그 (최근 50건)</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="p-2 text-left">시각</th>
                <th className="p-2 text-left">종목</th>
                <th className="p-2 text-left">구분</th>
                <th className="p-2 text-right">수량</th>
                <th className="p-2 text-right">가격</th>
                <th className="p-2 text-left">사유</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-gray-800">
                  <td className="p-2 text-gray-500">
                    {new Date(t.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="p-2">
                    {t.stock_name} ({t.stock_code})
                  </td>
                  <td
                    className={`p-2 font-medium ${
                      t.side === "BUY" ? "text-red-400" : "text-blue-400"
                    }`}
                  >
                    {t.side === "BUY" ? "매수" : "매도"}
                  </td>
                  <td className="p-2 text-right">{t.qty}</td>
                  <td className="p-2 text-right">{Number(t.price).toLocaleString()}</td>
                  <td className="p-2 text-gray-400">{t.reason}</td>
                </tr>
              ))}
              {trades.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    체결 내역 없음 (아직 매매가 발생하지 않았습니다)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">MACD / 시그널 차트</h2>
        <div className="flex gap-2 mb-3 flex-wrap">
          {trackedStocks.map((s) => (
            <a
              key={s.stock_code}
              href={`/?code=${s.stock_code}`}
              className={`px-3 py-1 rounded text-sm border ${
                s.stock_code === selectedCode
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {s.stock_name ?? s.stock_code}
            </a>
          ))}
          {trackedStocks.length === 0 && (
            <span className="text-gray-500 text-sm">
              아직 스캔된 종목이 없습니다 (cron 실행 후 표시됩니다)
            </span>
          )}
        </div>
        {signalHistory.length > 0 ? (
          <div className="rounded-lg border border-gray-800 p-2">
            <MacdChart data={signalHistory} />
          </div>
        ) : (
          <p className="text-gray-500 text-sm">선택된 종목의 시그널 기록이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
