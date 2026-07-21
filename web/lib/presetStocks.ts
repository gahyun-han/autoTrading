export interface PresetStock {
  code: string;
  name: string;
}

/** 백테스트/전략최적화 화면에서 기본으로 제공하는 5개 프리셋 종목 */
export const PRESET_STOCKS: PresetStock[] = [
  { code: "494310", name: "KODEX반도체레버리지" },
  { code: "233740", name: "KODEX코스닥150레버리지" },
  { code: "005930", name: "삼성전자" },
  { code: "000660", name: "SK하이닉스" },
  { code: "035420", name: "NAVER" },
];
