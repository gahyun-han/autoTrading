"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries, HistogramSeries } from "lightweight-charts";
import type { SignalRow } from "@/lib/queries";

export default function MacdChart({ data }: { data: SignalRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#0b0f19" }, textColor: "#d1d5db" },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      width: containerRef.current.clientWidth,
      height: 300,
      timeScale: { timeVisible: false },
    });

    const macdSeries = chart.addSeries(LineSeries, { color: "#60a5fa", lineWidth: 2 });
    const signalSeries = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2 });
    const histSeries = chart.addSeries(HistogramSeries, { color: "#4b5563" });

    const toTime = (dateStr: string, idx: number) => {
      // signal_log의 created_at은 매 cron 실행 시각이라 날짜만으로는 중복될 수 있어 인덱스 기반 정렬 사용
      const d = new Date(dateStr);
      return Math.floor(d.getTime() / 1000) + idx;
    };

    const sorted = [...data].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    macdSeries.setData(
      sorted.map((r, i) => ({ time: toTime(r.created_at, i) as any, value: Number(r.macd) })),
    );
    signalSeries.setData(
      sorted.map((r, i) => ({ time: toTime(r.created_at, i) as any, value: Number(r.macd_signal) })),
    );
    histSeries.setData(
      sorted.map((r, i) => ({
        time: toTime(r.created_at, i) as any,
        value: Number(r.macd_hist),
        color: Number(r.macd_hist) >= 0 ? "#22c55e" : "#ef4444",
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
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}
