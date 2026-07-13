"""진입점 - 1단계(인증) + 일봉 조회 + MACD 계산 확인용

사용 예:
    python main.py --code 005930 --start 20240101 --end 20241231
"""
import argparse

from api.market import fetch_daily_ohlcv
from strategy.indicators import calculate_macd


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--code", default="005930", help="종목코드")
    parser.add_argument("--start", required=True, help="조회 시작일 YYYYMMDD")
    parser.add_argument("--end", required=True, help="조회 종료일 YYYYMMDD")
    args = parser.parse_args()

    df = fetch_daily_ohlcv(args.code, args.start, args.end)
    if df.empty:
        print("조회된 데이터가 없습니다.")
        return

    df = calculate_macd(df)
    print(df.tail(20).to_string(index=False))


if __name__ == "__main__":
    main()
