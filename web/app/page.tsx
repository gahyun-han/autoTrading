import BacktestTab from "@/components/BacktestTab";
import { isDbConfigured } from "@/lib/db";
import { getBuyCandidates, getPositions, getRecentTrades } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [trades, positions, candidates] = await Promise.all([
    getRecentTrades(50),
    getPositions(),
    getBuyCandidates(20),
  ]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-200 p-8 font-sans">
      <h1 className="text-2xl font-bold mb-6">autoTrading 대시보드</h1>

      {!isDbConfigured() && (
        <div className="mb-6 rounded-lg border border-yellow-700 bg-yellow-950/40 p-4 text-sm text-yellow-300">
          DATABASE_URL(Neon Postgres)이 아직 연결되지 않았습니다. Vercel 대시보드 &gt;
          Storage 탭에서 Neon Postgres를 연결한 뒤 재배포하면 데이터가 표시됩니다.
        </div>
      )}

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

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">매매 후보 종목 ({candidates.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="p-2 text-left">종목</th>
                <th className="p-2 text-left">후보 사유</th>
                <th className="p-2 text-right">MACD</th>
                <th className="p-2 text-right">MA5</th>
                <th className="p-2 text-right">MA20</th>
                <th className="p-2 text-right">스캔 시각</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.stock_code} className="border-t border-gray-800">
                  <td className="p-2">
                    {c.stock_name ?? c.stock_code} ({c.stock_code})
                  </td>
                  <td className="p-2 text-gray-300">{c.reason ?? "-"}</td>
                  <td className="p-2 text-right">{Number(c.macd).toFixed(1)}</td>
                  <td className="p-2 text-right">{Number(c.ma5).toLocaleString()}</td>
                  <td className="p-2 text-right">{Number(c.ma20).toLocaleString()}</td>
                  <td className="p-2 text-right text-gray-500">
                    {new Date(c.created_at).toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    현재 매수 시그널이 뜬 후보 종목이 없습니다 (cron 실행 후 표시됩니다)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <BacktestTab />
    </div>
  );
}
