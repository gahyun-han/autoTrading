"use client";

import { useState } from "react";
import BacktestChart from "@/components/BacktestChart";

interface BacktestTrade {
  date: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  reason: string;
}

interface BacktestCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ma5: number | null;
  ma20: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
}

interface BacktestResult {
  stockCode: string;
  stockName: string;
  trades?: BacktestTrade[];
  invested?: number;
  finalValue?: number;
  finalReturnPct?: number;
  candles?: BacktestCandle[];
  error?: string;
}

function fmtDate(d: string) {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

const STRATEGIES = [
  { value: "default", label: "현재 전략 (골든크로스+MACD상향돌파+거래량급증, 4중 AND)" },
  { value: "confluence", label: "합류 전략 (MA정배열+RSI과매도복귀+MACD모멘텀전환)" },
];

export default function BacktestTab() {
  const [strategy, setStrategy] = useState("default");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResult[] | null>(null);
  const [dataStart, setDataStart] = useState<string | null>(null);
  const [dataEnd, setDataEnd] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function runBacktest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backtest?strategy=${strategy}`);
      if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
      const data = await res.json();
      setResults(data.results);
      setDataStart(data.dataStart);
      setDataEnd(data.dataEnd);
      setRanAt(data.ranAt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold">백테스트 (KIS 최대 조회기간, 약 100거래일)</h2>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded text-sm px-2 py-1 text-gray-300"
        >
          {STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={runBacktest}
          disabled={loading}
          className="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "실행 중..." : "백테스트 실행"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">오류: {error}</p>}

      {dataStart && (
        <p className="text-xs text-gray-500 mb-3">
          조회/시뮬레이션 기간: {fmtDate(dataStart)} ~ {dataEnd && fmtDate(dataEnd)} (KIS 일봉 API는
          요청 범위와 무관하게 최근 100거래일까지만 반환됨) · 실행 시각:{" "}
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
                    <td
                      className={`p-2 ${
                        !r.error && r.candles && r.candles.length > 0
                          ? "cursor-pointer hover:text-blue-400 hover:underline"
                          : ""
                      }`}
                      onClick={() => {
                        if (!r.error && r.candles && r.candles.length > 0) {
                          setExpanded(expanded === r.stockCode ? null : r.stockCode);
                        }
                      }}
                    >
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
                      {!r.error && r.candles && r.candles.length > 0 && (
                        <button
                          onClick={() =>
                            setExpanded(expanded === r.stockCode ? null : r.stockCode)
                          }
                          className="text-xs text-gray-400 hover:text-gray-200 underline"
                        >
                          {expanded === r.stockCode ? "닫기" : "차트/매매내역"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === r.stockCode && r.candles && (
                    <tr key={`${r.stockCode}-detail`} className="border-t border-gray-800 bg-gray-900/40">
                      <td colSpan={6} className="p-2">
                        <div className="mb-3 rounded border border-gray-800 p-2">
                          <BacktestChart candles={r.candles} trades={r.trades ?? []} />
                        </div>
                        {r.trades && r.trades.length > 0 ? (
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
                        ) : (
                          <p className="text-xs text-gray-500">해당 기간 매매 내역 없음</p>
                        )}
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
          백테스트를 실행하세요. (KIS API 한도 내 최대 기간인 약 100거래일치 데이터 사용)
        </p>
      )}
    </section>
  );
}
