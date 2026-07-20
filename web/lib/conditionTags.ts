// 매수 조건 태그 메타데이터 (해시태그 선택 UI + 서버 로직에서 공통으로 사용)
// 실제 판정 로직은 lib/strategy.ts의 TAG_CHECKS에 있음. 이 파일은 순수 데이터라 클라이언트에서도 안전하게 import 가능.

export interface TagMeta {
  id: string;
  label: string;
  category: string;
}

export const TAG_META: TagMeta[] = [
  { id: "ma5-gt-ma20", label: "MA5>MA20 정배열", category: "이동평균" },
  { id: "ma20-gt-ma60", label: "MA20>MA60 정배열", category: "이동평균" },
  { id: "ma60-gt-ma120", label: "MA60>MA120 정배열", category: "이동평균" },
  { id: "golden-cross", label: "골든크로스(MA5/MA20, 5일내)", category: "크로스" },
  { id: "dead-cross", label: "데드크로스(MA5/MA20)", category: "크로스" },
  { id: "rsi-30-rebound", label: "RSI 30 이탈복귀", category: "RSI" },
  { id: "rsi-40-rebound", label: "RSI 40 이탈복귀", category: "RSI" },
  { id: "macd-above-zero", label: "MACD 0선 위", category: "MACD" },
  { id: "macd-cross-up", label: "MACD 상향돌파", category: "MACD" },
  { id: "macd-hist-positive", label: "MACD 히스토그램 양전환", category: "MACD" },
  { id: "macd-momentum-window", label: "MACD 모멘텀 전환(5일내)", category: "MACD" },
  { id: "volume-surge", label: "거래량 급증(평균 1.5배)", category: "거래량" },
  { id: "ichimoku-tenkan-gt-kijun", label: "전환선>기준선", category: "일목균형표" },
  { id: "ichimoku-bullish-cloud", label: "양운(선행스팬1>선행스팬2)", category: "일목균형표" },
  { id: "ichimoku-above-cloud", label: "구름대 위 돌파", category: "일목균형표" },
];

// 프리셋: 기존 화면의 두 전략을 태그 조합으로 표현
export const PRESET_DEFAULT = ["golden-cross", "macd-above-zero", "macd-cross-up", "volume-surge"];
export const PRESET_CONFLUENCE = ["ma5-gt-ma20", "rsi-40-rebound", "macd-momentum-window"];

// 매도 조건 태그 메타데이터. 선택된 태그들은 OR로 결합되어 하나라도 충족하면 매도.
// 실제 판정 로직은 lib/strategy.ts의 SELL_TAG_CHECKS에 있음.
export const SELL_TAG_META: TagMeta[] = [
  { id: "sell-stop-loss-20", label: "손절 -20%", category: "손익률" },
  { id: "sell-take-profit-15", label: "익절 +15%", category: "손익률" },
  { id: "sell-profit-range-7to15", label: "수익 +7~+15% 구간 도달", category: "손익률" },
  { id: "sell-ma20-slope-turn-negative", label: "MA20 기울기 양→음 전환", category: "이동평균" },
  { id: "sell-dead-cross", label: "데드크로스(MA5/MA20)", category: "크로스" },
  { id: "sell-macd-hist-negative-turn", label: "MACD 히스토그램 양→음 전환", category: "MACD" },
  { id: "sell-macd-below-zero", label: "MACD 0선 이하", category: "MACD" },
  { id: "sell-rsi-overbought-exit", label: "RSI 70 과매수 이탈", category: "RSI" },
  { id: "sell-bollinger-upper-break-back", label: "볼린저 상단 터치 후 복귀", category: "볼린저밴드" },
  { id: "sell-bollinger-lower-break", label: "볼린저 하단 이탈(추세붕괴)", category: "볼린저밴드" },
  { id: "sell-ichimoku-close-below-cloud", label: "구름대 하향 이탈", category: "일목균형표" },
  { id: "sell-ichimoku-dead-cross", label: "전환선<기준선 데드크로스", category: "일목균형표" },
  { id: "sell-volume-climax", label: "거래량 급증+음봉(분산일)", category: "거래량" },
];

// 프리셋: 기존 하드코딩된 checkSellSignal과 동일한 조합 (기본값)
export const SELL_PRESET_DEFAULT = [
  "sell-stop-loss-20",
  "sell-take-profit-15",
  "sell-macd-hist-negative-turn",
  "sell-dead-cross",
  "sell-macd-below-zero",
];
// 프리셋: 손절은 유지하되 익절을 구간화하고 추세 반전(MA20 기울기)으로 대응
export const SELL_PRESET_TREND = [
  "sell-stop-loss-20",
  "sell-profit-range-7to15",
  "sell-ma20-slope-turn-negative",
];
