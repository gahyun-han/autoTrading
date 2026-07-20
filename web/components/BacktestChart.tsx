"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries, createSeriesMarkers } from "lightweight-charts";

interface BacktestCandle {
  date: string; // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
  ma5: number | null;
  ma20: number | null;
  rsi: number | null;
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
      height: 300,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderVisible: false,
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6",
    });

    candleSeries.setData(
      candles.map((c) => ({
        time: toTime(c.date) as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

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
          color: changePct > 0 ? "#eab308" : "#a855f7",
          shape: "square",
          text: `RSI ${cur.rsi.toFixed(0)}`,
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

  return <div ref={containerRef} className="w-full" />;
}
