"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries, createSeriesMarkers } from "lightweight-charts";

interface BacktestCandle {
  date: string; // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
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

    createSeriesMarkers(
      candleSeries,
      trades.map((t) => ({
        time: toTime(t.date) as any,
        position: t.side === "BUY" ? "belowBar" : "aboveBar",
        color: t.side === "BUY" ? "#ef4444" : "#3b82f6",
        shape: t.side === "BUY" ? "arrowUp" : "arrowDown",
        text: t.side === "BUY" ? "매수" : "매도",
      })),
    );

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
