// 프로젝트 공통 설정 (Python 버전 config.py와 동일한 값 사용)

export const APP_KEY = process.env.APP_KEY!;
export const APP_SECRET = process.env.APP_SECRET!;
export const ACCOUNT_NO = process.env.ACCOUNT_NO!;
export const MOCK = (process.env.MOCK ?? "true").toLowerCase() === "true";

// 모의투자 / 실전투자 도메인 분기
export const BASE_URL = MOCK
  ? "https://openapivts.koreainvestment.com:29443"
  : "https://openapi.koreainvestment.com:9443";

// MACD 파라미터
export const MACD_FAST = 12;
export const MACD_SLOW = 26;
export const MACD_SIGNAL = 9;

// 이동평균 (골든/데드크로스 판정용)
export const MA_SHORT = 5;
export const MA_LONG = 20;

// 전략 파라미터
export const GC_WINDOW = 5; // 골든크로스 인정 기간 (일)
export const STOP_LOSS_PCT = -20; // 손절 %
export const TAKE_PROFIT_PCT = 15; // 익절 %
export const MAX_POSITION = 7; // 최대 동시 보유 종목 수
export const INVEST_PER_STOCK = 500_000; // 종목당 투자금 (원)
export const VOLUME_SURGE_MULT = 1.5; // 거래량 평균 대비 배율 (이상 급등 필터)
export const UNIVERSE_SIZE = 100; // 코스피+코스닥 시가총액 상위 N개

// 합류(confluence) 전략 파라미터 (MA 정배열 + RSI 과매도 복귀 + MACD 모멘텀 전환)
export const RSI_OVERSOLD = 30;
export const RSI_REBOUND_WINDOW = 5; // 최근 N일 내 과매도 이탈 인정 기간
