"use client";

import { useState } from "react";
import BacktestChart from "@/components/BacktestChart";
import { PRESET_CONFLUENCE, PRESET_DEFAULT, TAG_META } from "@/lib/conditionTags";

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
  ma60: number | null;
  ma120: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  tenkan: number | null;
  kijun: number | null;
  spanA: number | null;
  spanB: number | null;
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

const TAG_CATEGORIES = Array.from(new Set(TAG_META.map((t) => t.category)));

export default function BacktestTab() {
  const [selectedTags, setSelectedTags] = useState<string[]>(PRESET_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResult[] | null>(null);
  const [dataStart, setDataStart] = useState<string | null>(null);
  const [dataEnd, setDataEnd] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleTag(id: string) {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function runBacktest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backtest?tags=${selectedTags.join(",")}`);
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
      <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
        <h2 className="text-base sm:text-lg font-semibold w-full sm:w-auto">
          백테스트 (KIS 최대 조회기간, 약 100거래일)
        </h2>
        <button
          onClick={() => setSelectedTags(PRESET_DEFAULT)}
          className="text-xs px-2.5 py-1.5 rounded border border-gray-700 text-gray-400 hover:border-gray-500"
        >
          프리셋: 기존 전략
        </button>
        <button
          onClick={() => setSelectedTags(PRESET_CONFLUENCE)}
          className="text-xs px-2.5 py-1.5 rounded border border-gray-700 text-gray-400 hover:border-gray-500"
        >
          프리셋: 합류 전략
        </button>
        <button
          onClick={() => setSelectedTags([])}
          className="text-xs px-2.5 py-1.5 rounded border border-gray-700 text-gray-400 hover:border-gray-500"
        >
          전체 해제
        </button>
      </div>

      <div className="mb-3 space-y-2">
        {TAG_CATEGORIES.map((cat) => (
          <div key={cat} className="flex items-start sm:items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 w-full sm:w-16 shrink-0">{cat}</span>
            {TAG_META.filter((t) => t.category === cat).map((t) => {
              const active = selectedTags.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                    active
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  #{t.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <p className="text-xs text-gray-400">
          선택된 조건 ({selectedTags.length}개, AND 결합):{" "}
          {selectedTags.length > 0
            ? selectedTags.map((id) => TAG_META.find((t) => t.id === id)?.label ?? id).join(" + ")
            : "없음"}
        </p>
        <button
          onClick={runBacktest}
          disabled={loading}
          className="px-3 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="p-2 text-left whitespace-nowrap">종목</th>
                <th className="p-2 text-right whitespace-nowrap">투자금</th>
                <th className="p-2 text-right whitespace-nowrap">최종평가액</th>
                <th className="p-2 text-right whitespace-nowrap">수익률</th>
                <th className="p-2 text-right whitespace-nowrap">매매횟수</th>
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
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="text-gray-500">
                                <tr>
                                  <th className="p-1 text-left whitespace-nowrap">날짜</th>
                                  <th className="p-1 text-left whitespace-nowrap">구분</th>
                                  <th className="p-1 text-right whitespace-nowrap">가격</th>
                                  <th className="p-1 text-right whitespace-nowrap">수량</th>
                                  <th className="p-1 text-left min-w-[160px]">사유</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.trades.map((t, i) => (
                                  <tr key={i} className="border-t border-gray-800">
                                    <td className="p-1 whitespace-nowrap">{fmtDate(t.date)}</td>
                                    <td
                                      className={`p-1 font-medium whitespace-nowrap ${
                                        t.side === "BUY" ? "text-red-400" : "text-blue-400"
                                      }`}
                                    >
                                      {t.side === "BUY" ? "매수" : "매도"}
                                    </td>
                                    <td className="p-1 text-right whitespace-nowrap">{t.price.toLocaleString()}</td>
                                    <td className="p-1 text-right whitespace-nowrap">{t.qty}</td>
                                    <td className="p-1 text-gray-400">{t.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
