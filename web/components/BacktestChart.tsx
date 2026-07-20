"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
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

    const isMobile = window.innerWidth < 640;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0f19" },
        textColor: "#d1d5db",
        // MACD 구간 경계선을 드래그로 리사이즈하지 못하도록 고정
        panes: { enableResize: false },
      },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      width: containerRef.current.clientWidth,
      height: isMobile ? 320 : 420,
      handleScale: {
        // 손가락으로 세로 스크롤/드래그 시 Y축이 확대축소되지 않도록 축 스케일 제스처 최소화
        axisPressedMouseMove: { time: true, price: false },
        pinch: false,
        mouseWheel: false,
      },
      handleScroll: {
        // 세로 터치 드래그는 페이지 스크롤로 넘기고, 차트는 가로 이동만 처리
        vertTouchDrag: false,
        horzTouchDrag: true,
        pressedMouseMove: true,
        mouseWheel: false,
      },
    });

    // 일목균형표 구름대(선행스팬1/2 사이 영역 채우기): 상단(고점) 영역을 채운 뒤,
    // 그 위에 배경색과 동일한 색으로 하단(저점) 영역을 덮어 두 선 사이만 남기는 방식.
    // (lightweight-charts에 두 선 사이를 채우는 기능이 없어 Area 시리즈 2개로 구현)
    // 캔들/가격선보다 먼저 추가해 구름이 항상 가격 아래에 깔리도록 함.
    const CHART_BG = "#0b0f19";
    const CLOUD_BULLISH = "rgba(34, 197, 94, 0.18)"; // 양운(스팬1>스팬2)
    const CLOUD_BEARISH = "rgba(248, 113, 113, 0.18)"; // 음운(스팬1<스팬2)

    type CloudPoint = { time: any; value: number };
    let run: { upper: CloudPoint[]; lower: CloudPoint[]; bullish: boolean } | null = null;
    const cloudRuns: { upper: CloudPoint[]; lower: CloudPoint[]; bullish: boolean }[] = [];

    for (const c of candles) {
      if (c.spanA == null || c.spanB == null) {
        run = null;
        continue;
      }
      const bullish = c.spanA >= c.spanB;
      const t = toTime(c.date) as any;
      const point = { upper: { time: t, value: Math.max(c.spanA, c.spanB) }, lower: { time: t, value: Math.min(c.spanA, c.spanB) } };
      if (!run || run.bullish !== bullish) {
        run = { upper: [point.upper], lower: [point.lower], bullish };
        cloudRuns.push(run);
      } else {
        run.upper.push(point.upper);
        run.lower.push(point.lower);
      }
    }

    for (const seg of cloudRuns) {
      const upperSeries = chart.addSeries(
        AreaSeries,
        {
          topColor: seg.bullish ? CLOUD_BULLISH : CLOUD_BEARISH,
          bottomColor: seg.bullish ? CLOUD_BULLISH : CLOUD_BEARISH,
          lineColor: "rgba(0,0,0,0)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        0,
      );
      upperSeries.setData(seg.upper as any);

      const lowerMaskSeries = chart.addSeries(
        AreaSeries,
        {
          topColor: CHART_BG,
          bottomColor: CHART_BG,
          lineColor: "rgba(0,0,0,0)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        0,
      );
      lowerMaskSeries.setData(seg.lower as any);
    }

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

    const ma60Series = chart.addSeries(
      LineSeries,
      { color: "#94a3b8", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false },
      0,
    );
    ma60Series.setData(
      candles
        .filter((c) => c.ma60 != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.ma60 as number })),
    );

    const ma120Series = chart.addSeries(
      LineSeries,
      { color: "#ec4899", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false },
      0,
    );
    ma120Series.setData(
      candles
        .filter((c) => c.ma120 != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.ma120 as number })),
    );

    // 일목균형표: 전환선/기준선/선행스팬1·2 (스팬은 정석과 달리 26일 선행 이동 없이 당일 값으로 표시)
    const tenkanSeries = chart.addSeries(
      LineSeries,
      { color: "#2dd4bf", lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
      0,
    );
    tenkanSeries.setData(
      candles
        .filter((c) => c.tenkan != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.tenkan as number })),
    );

    const kijunSeries = chart.addSeries(
      LineSeries,
      { color: "#f472b6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
      0,
    );
    kijunSeries.setData(
      candles
        .filter((c) => c.kijun != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.kijun as number })),
    );

    const spanASeries = chart.addSeries(
      LineSeries,
      { color: "#84cc16", lineWidth: 1, lineStyle: 1, priceLineVisible: false, lastValueVisible: false },
      0,
    );
    spanASeries.setData(
      candles
        .filter((c) => c.spanA != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.spanA as number })),
    );

    const spanBSeries = chart.addSeries(
      LineSeries,
      { color: "#fb923c", lineWidth: 1, lineStyle: 3, priceLineVisible: false, lastValueVisible: false },
      0,
    );
    spanBSeries.setData(
      candles
        .filter((c) => c.spanB != null)
        .map((c) => ({ time: toTime(c.date) as any, value: c.spanB as number })),
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
    if (panes.length > 1) panes[1].setHeight(isMobile ? 90 : 120);

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
        const t = toTime(cur.date) as any;
        // 대비색(흰색) 테두리를 먼저 그리고 그 위에 본 마커를 겹쳐 시인성을 높임
        crossMarkers.push({ time: t, position: "belowBar", color: "#ffffff", shape: "circle", size: 1.8, text: "" });
        crossMarkers.push({ time: t, position: "belowBar", color: "#22c55e", shape: "circle", size: 1, text: "GC" });
      } else if (prev.ma5 >= prev.ma20 && cur.ma5 < cur.ma20) {
        const t = toTime(cur.date) as any;
        crossMarkers.push({ time: t, position: "aboveBar", color: "#ffffff", shape: "circle", size: 1.8, text: "" });
        crossMarkers.push({ time: t, position: "aboveBar", color: "#f97316", shape: "circle", size: 1, text: "DC" });
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
      <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 mt-1 text-[10px] sm:text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: "#facc15" }} />
          MA5
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: "#38bdf8" }} />
          MA20 (MA5&gt;MA20: 정배열, MA5&lt;MA20: 역배열)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t border-dashed" style={{ borderColor: "#94a3b8" }} />
          MA60
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t border-dashed" style={{ borderColor: "#ec4899" }} />
          MA120
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: "#2dd4bf" }} />
          전환선
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: "#f472b6" }} />
          기준선
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t border-dotted" style={{ borderColor: "#84cc16" }} />
          선행스팬1
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t border-dotted" style={{ borderColor: "#fb923c" }} />
          선행스팬2 (26일 선행이동 없이 당일값 표시)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(34,197,94,0.35)" }} />
          구름대 양운(스팬1&gt;스팬2)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(248,113,113,0.35)" }} />
          구름대 음운(스팬1&lt;스팬2)
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: "#22c55e", boxShadow: "0 0 0 1.5px #ffffff" }}
          />
          GC(골든크로스)
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: "#f97316", boxShadow: "0 0 0 1.5px #ffffff" }}
          />
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
