"""프로젝트 공통 설정"""
import os

from dotenv import load_dotenv

load_dotenv()

APP_KEY = os.getenv("APP_KEY")
APP_SECRET = os.getenv("APP_SECRET")
ACCOUNT_NO = os.getenv("ACCOUNT_NO")
MOCK = os.getenv("MOCK", "true").lower() == "true"

# 모의투자 / 실전투자 도메인 분기
BASE_URL = (
    "https://openapivts.koreainvestment.com:29443"
    if MOCK
    else "https://openapi.koreainvestment.com:9443"
)

# MACD 파라미터
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
