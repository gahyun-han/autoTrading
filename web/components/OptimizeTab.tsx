"use client";

import { useState } from "react";
import BacktestChart from "@/components/BacktestChart";
import { SELL_TAG_META, TAG_META } from "@/lib/conditionTags";

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

interface BestResult {
  stockCode: string;
  stockName: string;
  trades: BacktestTrade[];
  invested: number;
  finalValue: number;
  finalReturnPct: number;
  candles: BacktestCandle[];
}

interface ComboResult {
  buyTags: string[];
  sellTags: string[];
  avgReturnPct: number;
  totalTrades: number;
  perStock: { stockCode: string; stockName: string; returnPct: number; trades: number }[];
}

interface ComboSizeStat {
  size: number;
  avgReturnPct: number;
  count: number;
}

interface RsiSensitivityPoint {
  threshold: number;
  avgReturnPct: number;
}

interface OptimizeReport {
  searchedCount: number;
  topCombos: ComboResult[];
  bestOverall: ComboResult;
  buyComboSizeStats: ComboSizeStat[];
  sellComboSizeStats: ComboSizeStat[];
  buyRsiSensitivity: RsiSensitivityPoint[];
  sellRsiSensitivity: RsiSensitivityPoint[];
  bestOverallResults: BestResult[];
  dataStart: string;
  dataEnd: string;
  ranAt: string;
  fetchErrors?: { stockCode: string; stockName: string; error: string }[];
}

function fmtDate(d: string) {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function buyLabel(id: string) {
  return TAG_META.find((t) => t.id === id)?.label ?? id;
}

function sellLabel(id: string) {
  return SELL_TAG_META.find((t) => t.id === id)?.label ?? id;
}

export default function OptimizeTab() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<OptimizeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [expandedCombo, setExpandedCombo] = useState<number | null>(null);

  async function runOptimize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest/optimize");
      if (!res.ok) throw new Error(`요청 실패: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReport(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
        <h2 className="text-base sm:text-lg font-semibold w-full sm:w-auto">전략 최적화 (조합/지표값 비교)</h2>
        <button
          onClick={runOptimize}
          disabled={loading}
          className="px-3 py-2 rounded text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "탐색 중..." : "최적화 실행"}
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        매수조건 1~3개 조합, 매도조건 1~3개 조합, RSI 임계값(매수 이탈복귀/매도 과매수이탈)을 바꿔가며
        5개 종목 백테스트를 반복 실행해 수익률을 비교합니다. 전체 조합의 곱(수십만개)은 계산량이 커서,
        매수조합 우선탐색 → 매도조합 우선탐색 → 상위 조합 교차검증 순서의 단계적 탐색을 사용합니다.
      </p>

      {error && <p className="text-sm text-red-400 mb-3">오류: {error}</p>}

      {report && (
        <div className="space-y-6">
          <p className="text-xs text-gray-500">
            조회기간: {fmtDate(report.dataStart)} ~ {fmtDate(report.dataEnd)} · 탐색한 조합/파라미터 수:{" "}
            {report.searchedCount.toLocaleString()}개 · 실행 시각:{" "}
            {new Date(report.ranAt).toLocaleString("ko-KR")}
          </p>
          {report.fetchErrors && report.fetchErrors.length > 0 && (
            <p className="text-xs text-yellow-400">
              일부 종목 데이터 조회 실패: {report.fetchErrors.map((e) => `${e.stockName}(${e.error})`).join(", ")}
            </p>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">매수조건 개수별 평균 수익률 (매도조건은 기존 전략 고정)</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="p-2 text-left">조합 개수</th>
                    <th className="p-2 text-right">평균 수익률</th>
                    <th className="p-2 text-right">조합 수</th>
                  </tr>
                </thead>
                <tbody>
                  {report.buyComboSizeStats.map((s) => (
                    <tr key={s.size} className="border-t border-gray-800">
                      <td className="p-2">{s.size}개</td>
                      <td
                        className={`p-2 text-right font-medium ${
                          s.avgReturnPct >= 0 ? "text-red-400" : "text-blue-400"
                        }`}
                      >
                        {s.avgReturnPct.toFixed(2)}%
                      </td>
                      <td className="p-2 text-right">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">매도조건 개수별 평균 수익률 (매수조건은 기존 전략 고정)</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="p-2 text-left">조합 개수</th>
                    <th className="p-2 text-right">평균 수익률</th>
                    <th className="p-2 text-right">조합 수</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sellComboSizeStats.map((s) => (
                    <tr key={s.size} className="border-t border-gray-800">
                      <td className="p-2">{s.size}개</td>
                      <td
                        className={`p-2 text-right font-medium ${
                          s.avgReturnPct >= 0 ? "text-red-400" : "text-blue-400"
                        }`}
                      >
                        {s.avgReturnPct.toFixed(2)}%
                      </td>
                      <td className="p-2 text-right">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">RSI 매수 이탈복귀 임계값 민감도</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-900 text-gray-400">
                    <tr>
                      <th className="p-2 text-left">RSI 임계값</th>
                      <th className="p-2 text-right">평균 수익률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.buyRsiSensitivity.map((p) => (
                      <tr key={p.threshold} className="border-t border-gray-800">
                        <td className="p-2">{p.threshold}</td>
                        <td
                          className={`p-2 text-right font-medium ${
                            p.avgReturnPct >= 0 ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {p.avgReturnPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">RSI 매도 과매수이탈 임계값 민감도</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-900 text-gray-400">
                    <tr>
                      <th className="p-2 text-left">RSI 임계값</th>
                      <th className="p-2 text-right">평균 수익률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sellRsiSensitivity.map((p) => (
                      <tr key={p.threshold} className="border-t border-gray-800">
                        <td className="p-2">{p.threshold}</td>
                        <td
                          className={`p-2 text-right font-medium ${
                            p.avgReturnPct >= 0 ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {p.avgReturnPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">
              상위 {report.topCombos.length}개 조합 (5개 종목 평균 수익률 순, 행 클릭 시 종목별 수익률 확인)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="p-2 text-left whitespace-nowrap">순위</th>
                    <th className="p-2 text-left min-w-[220px]">매수조건</th>
                    <th className="p-2 text-left min-w-[220px]">매도조건</th>
                    <th className="p-2 text-right whitespace-nowrap">평균 수익률</th>
                    <th className="p-2 text-right whitespace-nowrap">총 매매횟수</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topCombos.map((c, i) => (
                    <>
                      <tr
                        key={i}
                        onClick={() => setExpandedCombo(expandedCombo === i ? null : i)}
                        className={`border-t border-gray-800 cursor-pointer hover:bg-gray-900/60 ${
                          i === 0 ? "bg-purple-950/30" : ""
                        }`}
                      >
                        <td className="p-2">{i + 1}{i === 0 ? " 🏆" : ""}</td>
                        <td className="p-2 text-gray-300">{c.buyTags.map(buyLabel).join(" + ")}</td>
                        <td className="p-2 text-gray-300">{c.sellTags.map(sellLabel).join(" 또는 ")}</td>
                        <td
                          className={`p-2 text-right font-medium ${
                            c.avgReturnPct >= 0 ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {c.avgReturnPct.toFixed(2)}%
                        </td>
                        <td className="p-2 text-right">{c.totalTrades}</td>
                      </tr>
                      {expandedCombo === i && (
                        <tr key={`${i}-detail`} className="border-t border-gray-800 bg-gray-900/40">
                          <td colSpan={5} className="p-2">
                            <table className="w-full text-xs">
                              <thead className="text-gray-500">
                                <tr>
                                  <th className="p-1 text-left whitespace-nowrap">종목</th>
                                  <th className="p-1 text-right whitespace-nowrap">수익률</th>
                                  <th className="p-1 text-right whitespace-nowrap">매매횟수</th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.perStock.map((p) => (
                                  <tr key={p.stockCode} className="border-t border-gray-800">
                                    <td className="p-1 whitespace-nowrap">
                                      {p.stockName} ({p.stockCode})
                                    </td>
                                    <td
                                      className={`p-1 text-right font-medium ${
                                        p.returnPct >= 0 ? "text-red-400" : "text-blue-400"
                                      }`}
                                    >
                                      {p.returnPct.toFixed(2)}%
                                    </td>
                                    <td className="p-1 text-right">{p.trades}</td>
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
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">
              최고 조합 상세: {report.bestOverall.buyTags.map(buyLabel).join(" + ")} / 매도:{" "}
              {report.bestOverall.sellTags.map(sellLabel).join(" 또는 ")}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-xs sm:text-sm">
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
                  {report.bestOverallResults.map((r) => (
                    <>
                      <tr key={r.stockCode} className="border-t border-gray-800">
                        <td
                          className="p-2 cursor-pointer hover:text-blue-400 hover:underline"
                          onClick={() =>
                            setExpandedStock(expandedStock === r.stockCode ? null : r.stockCode)
                          }
                        >
                          {r.stockName} ({r.stockCode})
                        </td>
                        <td className="p-2 text-right">{r.invested?.toLocaleString()}</td>
                        <td className="p-2 text-right">{Math.round(r.finalValue ?? 0).toLocaleString()}</td>
                        <td
                          className={`p-2 text-right font-medium ${
                            (r.finalReturnPct ?? 0) >= 0 ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {r.finalReturnPct?.toFixed(2)}%
                        </td>
                        <td className="p-2 text-right">{r.trades?.length ?? 0}</td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() =>
                              setExpandedStock(expandedStock === r.stockCode ? null : r.stockCode)
                            }
                            className="text-xs text-gray-400 hover:text-gray-200 underline"
                          >
                            {expandedStock === r.stockCode ? "닫기" : "차트/매매내역"}
                          </button>
                        </td>
                      </tr>
                      {expandedStock === r.stockCode && (
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
                                        <td className="p-1 text-right whitespace-nowrap">
                                          {t.price.toLocaleString()}
                                        </td>
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
          </div>
        </div>
      )}

      {!report && !loading && (
        <p className="text-gray-500 text-sm">
          버튼을 눌러 매수/매도 조건 조합과 RSI 임계값을 바꿔가며 5개 종목 백테스트를 반복 실행하고,
          가장 수익률이 좋은 조합을 찾아보세요.
        </p>
      )}
    </section>
  );
}
