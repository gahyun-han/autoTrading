"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
} from "lightweight-charts";

interface BacktestCandle {
  date: string; // YYYYMMDD
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

interface BacktestTrade {
  date: string; // YYYYMMDD
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  reason: string;
}

function toTime(dateStr: string) {
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

export default function BacktestChart({
  candles,
  trades,
}: {
  candles: BacktestCandle[];
  trades: BacktestTrade[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#0b0f19" }, textColor: "#d1d5db" },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      width: containerRef.current.clientWidth,
      height: 420,
    });

    // 가격 pane(0): 캔들 + MA5/MA20 (정배열/역배열을 선으로 바로 확인)
    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#ef4444",
        downColor: "#3b82f6",
        borderVisible: false,
        wickUpColor: "#ef4444",
        wickDownColor: "#3b82f6",
      },
      0,
    );

    candleSeries.setData(
      candles.map((c) => ({
        time: toTime(c.date) as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const ma5Series = chart.addSeries(
      LineSeries,
      { color: "#facc15", lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
      0,
    );
    ma5Series.setData(
      candles
        .filter((c) => c.ma5 != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.ma5 as number })),
    );

    const ma20Series = chart.addSeries(
      LineSeries,
      { color: "#38bdf8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
      0,
    );
    ma20Series.setData(
      candles
        .filter((c) => c.ma20 != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.ma20 as number })),
    );

    // MACD pane(1): MACD선, 시그널선, 히스토그램 (모멘텀 전환을 한 눈에 확인)
    const macdHistSeries = chart.addSeries(
      HistogramSeries,
      { priceLineVisible: false, lastValueVisible: false },
      1,
    );
    macdHistSeries.setData(
      candles
        .filter((c) => c.macdHist != null)
        .map((c) => ({
          time: toTime(c.date) as any,
          value: c.macdHist as number,
          color: (c.macdHist as number) >= 0 ? "#ef4444" : "#3b82f6",
        })),
    );

    const macdLineSeries = chart.addSeries(
      LineSeries,
      { color: "#facc15", lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
      1,
    );
    macdLineSeries.setData(
      candles
        .filter((c) => c.macd != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.macd as number })),
    );

    const macdSignalSeries = chart.addSeries(
      LineSeries,
      { color: "#a855f7", lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
      1,
    );
    macdSignalSeries.setData(
      candles
        .filter((c) => c.macdSignal != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.macdSignal as number })),
    );

    const panes = chart.panes();
    if (panes.length > 1) panes[1].setHeight(120);

    const tradeMarkers: any[] = trades.map((t) => ({
      time: toTime(t.date) as any,
      position: t.side === "BUY" ? "belowBar" : "aboveBar",
      color: t.side === "BUY" ? "#ef4444" : "#3b82f6",
      shape: t.side === "BUY" ? "arrowUp" : "arrowDown",
      text: t.side === "BUY" ? "매수" : "매도",
    }));

    // 골든크로스/데드크로스 마커 (MA5가 MA20을 상향/하향 돌파)
    const crossMarkers: any[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const cur = candles[i];
      if (prev.ma5 == null || prev.ma20 == null || cur.ma5 == null || cur.ma20 == null) {
        continue;
      }
      if (prev.ma5 <= prev.ma20 && cur.ma5 > cur.ma20) {
        crossMarkers.push({
          time: toTime(cur.date) as any,
          position: "belowBar",
          color: "#22c55e",
          shape: "circle",
          text: "GC",
        });
      } else if (prev.ma5 >= prev.ma20 && cur.ma5 < cur.ma20) {
        crossMarkers.push({
          time: toTime(cur.date) as any,
          position: "aboveBar",
          color: "#f97316",
          shape: "circle",
          text: "DC",
        });
      }
    }

    // 전일 대비 큰 폭(±3%) 변동 지점에 RSI 수치 표시
    const rsiMarkers: any[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const cur = candles[i];
      if (cur.rsi == null || prev.close === 0) continue;
      const changePct = ((cur.close - prev.close) / prev.close) * 100;
      if (Math.abs(changePct) >= 3) {
        rsiMarkers.push({
          time: toTime(cur.date) as any,
          position: changePct > 0 ? "aboveBar" : "belowBar",
          color: "#eab308",
          shape: "circle",
          size: 0,
          text: cur.rsi.toFixed(0),
        });
      }
    }

    const allMarkers = [...tradeMarkers, ...crossMarkers, ...rsiMarkers].sort(
      (a, b) => (a.time as string).localeCompare(b.time as string),
    );

    createSeriesMarkers(candleSeries, allMarkers);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles, trades]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: "#facc15" }} />
          MA5
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: "#38bdf8" }} />
          MA20 (MA5&gt;MA20: 정배열, MA5&lt;MA20: 역배열)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
          GC(골든크로스)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#f97316" }} />
          DC(데드크로스)
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: "#eab308" }}>숫자</span> = RSI (전일比 ±3% 이상 변동 시)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: "#facc15" }} />
          MACD
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: "#a855f7" }} />
          Signal
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2" style={{ background: "#ef4444" }} />
          히스토그램 양(모멘텀 상승)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2" style={{ background: "#3b82f6" }} />
          히스토그램 음(모멘텀 하락)
        </span>
      </div>
    </div>
  );
}
