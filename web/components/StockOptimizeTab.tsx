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
  stockCount: number;
  topCombos: ComboResult[];
  bestOverall: ComboResult;
  buyComboSizeStats: ComboSizeStat[];
  sellComboSizeStats: ComboSizeStat[];
  sellSearchBuyTags: string[];
  buyRsiSensitivity: RsiSensitivityPoint[];
  sellRsiSensitivity: RsiSensitivityPoint[];
  bestOverallResults: BestResult[];
  dataStart: string;
  dataEnd: string;
  ranAt: string;
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

export default function StockOptimizeTab() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<OptimizeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCombo, setExpandedCombo] = useState<number | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  async function runOptimize() {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("종목코드는 6자리 숫자로 입력해주세요 (예: 005930)");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setChartOpen(false);
    try {
      const params = new URLSearchParams({ code: trimmed });
      if (name.trim()) params.set("name", name.trim());
      const res = await fetch(`/api/backtest/optimize-stock?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `요청 실패: ${res.status}`);
      setReport(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const best = report?.bestOverallResults?.[0];

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
        <h2 className="text-base sm:text-lg font-semibold w-full sm:w-auto">종목별 최적 전략 찾기</h2>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        종목코드 하나를 입력하면 그 종목만 대상으로 매수/매도 조건 조합(1~3개)과 RSI 임계값을 바꿔가며
        백테스트를 반복 실행해 가장 수익률이 좋은 매매법을 찾습니다.
      </p>

      <div className="flex items-end gap-2 sm:gap-3 mb-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">종목코드 (6자리)</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runOptimize()}
            placeholder="005930"
            maxLength={6}
            className="w-28 px-2 py-2 rounded bg-gray-900 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">종목명 (선택)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runOptimize()}
            placeholder="삼성전자"
            className="w-36 px-2 py-2 rounded bg-gray-900 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={runOptimize}
          disabled={loading}
          className="px-3 py-2 rounded text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "탐색 중..." : "최적 전략 찾기"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">오류: {error}</p>}

      {report && (
        <div className="space-y-6">
          <p className="text-xs text-gray-500">
            {best?.stockName} ({best?.stockCode}) · 조회기간: {fmtDate(report.dataStart)} ~{" "}
            {fmtDate(report.dataEnd)} · 탐색한 조합/파라미터 수: {report.searchedCount.toLocaleString()}개 ·
            실행 시각: {new Date(report.ranAt).toLocaleString("ko-KR")}
          </p>

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
            <h3 className="text-sm font-semibold mb-2">
              매도조건 개수별 평균 수익률 (매수조건은 1단계 최고 조합 고정:{" "}
              {report.sellSearchBuyTags.map(buyLabel).join(" + ")})
            </h3>
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
              <h3 className="text-sm font-semibold mb-2">
                RSI 매도 과매수이탈 임계값 민감도 (매수조건: {report.sellSearchBuyTags.map(buyLabel).join(" + ")})
              </h3>
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
              상위 {report.topCombos.length}개 조합 (이 종목 수익률 순, 행 클릭 시 상세)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="p-2 text-left whitespace-nowrap">순위</th>
                    <th className="p-2 text-left min-w-[220px]">매수조건</th>
                    <th className="p-2 text-left min-w-[220px]">매도조건</th>
                    <th className="p-2 text-right whitespace-nowrap">수익률</th>
                    <th className="p-2 text-right whitespace-nowrap">매매횟수</th>
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
                      {expandedCombo === i && best && (
                        <tr key={`${i}-detail`} className="border-t border-gray-800 bg-gray-900/40">
                          <td colSpan={5} className="p-2 text-xs text-gray-400">
                            총 {c.totalTrades}회 매매 · 아래 &quot;최고 조합 상세&quot;는 1위 조합(🏆) 기준
                            차트를 보여줍니다.
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {best && (
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
                    <tr className="border-t border-gray-800">
                      <td
                        className="p-2 cursor-pointer hover:text-blue-400 hover:underline"
                        onClick={() => setChartOpen((v) => !v)}
                      >
                        {best.stockName} ({best.stockCode})
                      </td>
                      <td className="p-2 text-right">{best.invested?.toLocaleString()}</td>
                      <td className="p-2 text-right">{Math.round(best.finalValue ?? 0).toLocaleString()}</td>
                      <td
                        className={`p-2 text-right font-medium ${
                          (best.finalReturnPct ?? 0) >= 0 ? "text-red-400" : "text-blue-400"
                        }`}
                      >
                        {best.finalReturnPct?.toFixed(2)}%
                      </td>
                      <td className="p-2 text-right">{best.trades?.length ?? 0}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => setChartOpen((v) => !v)}
                          className="text-xs text-gray-400 hover:text-gray-200 underline"
                        >
                          {chartOpen ? "닫기" : "차트/매매내역"}
                        </button>
                      </td>
                    </tr>
                    {chartOpen && (
                      <tr className="border-t border-gray-800 bg-gray-900/40">
                        <td colSpan={6} className="p-2">
                          <div className="mb-3 rounded border border-gray-800 p-2">
                            <BacktestChart candles={best.candles} trades={best.trades ?? []} />
                          </div>
                          {best.trades && best.trades.length > 0 ? (
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
                                  {best.trades.map((t, i) => (
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
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!report && !loading && (
        <p className="text-gray-500 text-sm">
          종목코드를 입력하고 버튼을 누르면 해당 종목에 가장 잘 맞는 매수/매도 조건 조합을 찾아드립니다.
        </p>
      )}
    </section>
  );
}
