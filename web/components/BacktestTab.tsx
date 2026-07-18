"use client";

import { useState } from "react";

interface BacktestTrade {
  date: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  reason: string;
}

interface BacktestResult {
  stockCode: string;
  stockName: string;
  trades?: BacktestTrade[];
  invested?: number;
  finalValue?: number;
  finalReturnPct?: number;
  error?: string;
}

function fmtDate(d: string) {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export default function BacktestTab() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResult[] | null>(null);
  const [backtestStart, setBacktestStart] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function runBacktest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest");
      if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
      const data = await res.json();
      setResults(data.results);
      setBacktestStart(data.backtestStart);
      setRanAt(data.ranAt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold">백테스트 (최근 1개월)</h2>
        <button
          onClick={runBacktest}
          disabled={loading}
          className="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "실행 중..." : "백테스트 실행"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-3">오류: {error}</p>
      )}

      {backtestStart && (
        <p className="text-xs text-gray-500 mb-3">
          시뮬레이션 시작일: {fmtDate(backtestStart)} · 실행 시각:{" "}
          {ranAt ? new Date(ranAt).toLocaleString("ko-KR") : "-"}
        </p>
      )}

      {results && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="p-2 text-left">종목</th>
                <th className="p-2 text-right">투자금</th>
                <th className="p-2 text-right">최종평가액</th>
                <th className="p-2 text-right">수익률</th>
                <th className="p-2 text-right">매매횟수</th>
                <th className="p-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <>
                  <tr key={r.stockCode} className="border-t border-gray-800">
                    <td className="p-2">
                      {r.stockName} ({r.stockCode})
                    </td>
                    {r.error ? (
                      <td colSpan={4} className="p-2 text-red-400">
                        오류: {r.error}
                      </td>
                    ) : (
                      <>
                        <td className="p-2 text-right">{r.invested?.toLocaleString()}</td>
                        <td className="p-2 text-right">
                          {Math.round(r.finalValue ?? 0).toLocaleString()}
                        </td>
                        <td
                          className={`p-2 text-right font-medium ${
                            (r.finalReturnPct ?? 0) >= 0 ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {r.finalReturnPct?.toFixed(2)}%
                        </td>
                        <td className="p-2 text-right">{r.trades?.length ?? 0}</td>
                      </>
                    )}
                    <td className="p-2 text-right">
                      {!r.error && r.trades && r.trades.length > 0 && (
                        <button
                          onClick={() =>
                            setExpanded(expanded === r.stockCode ? null : r.stockCode)
                          }
                          className="text-xs text-gray-400 hover:text-gray-200 underline"
                        >
                          {expanded === r.stockCode ? "닫기" : "매매내역"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === r.stockCode && r.trades && (
                    <tr key={`${r.stockCode}-detail`} className="border-t border-gray-800 bg-gray-900/40">
                      <td colSpan={6} className="p-2">
                        <table className="w-full text-xs">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="p-1 text-left">날짜</th>
                              <th className="p-1 text-left">구분</th>
                              <th className="p-1 text-right">가격</th>
                              <th className="p-1 text-right">수량</th>
                              <th className="p-1 text-left">사유</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.trades.map((t, i) => (
                              <tr key={i} className="border-t border-gray-800">
                                <td className="p-1">{fmtDate(t.date)}</td>
                                <td
                                  className={`p-1 font-medium ${
                                    t.side === "BUY" ? "text-red-400" : "text-blue-400"
                                  }`}
                                >
                                  {t.side === "BUY" ? "매수" : "매도"}
                                </td>
                                <td className="p-1 text-right">{t.price.toLocaleString()}</td>
                                <td className="p-1 text-right">{t.qty}</td>
                                <td className="p-1 text-gray-400">{t.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!results && !loading && (
        <p className="text-gray-500 text-sm">
          버튼을 눌러 5개 종목(반도체레버리지/코스닥150레버리지/삼성전자/SK하이닉스/NAVER)의
          최근 1개월 백테스트를 실행하세요.
        </p>
      )}
    </section>
  );
}
