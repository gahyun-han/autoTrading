"""시세 데이터 조회 - 일봉(OHLCV)"""
from __future__ import annotations

import pandas as pd
import requests

from auth.kis_auth import get_headers
from config import BASE_URL

_DAILY_CHART_TR_ID = "FHKST03010100"
_DAILY_CHART_PATH = "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"


def fetch_daily_ohlcv(
    stock_code: str,
    start_date: str,
    end_date: str,
    adj_price: bool = True,
) -> pd.DataFrame:
    """일봉 OHLCV 데이터 조회

    Args:
        stock_code: 종목코드 (예: "005930")
        start_date: 조회 시작일 (YYYYMMDD)
        end_date: 조회 종료일 (YYYYMMDD)
        adj_price: 수정주가 반영 여부

    Returns:
        date, open, high, low, close, volume 컬럼을 가진 DataFrame (날짜 오름차순)
    """
    url = f"{BASE_URL}{_DAILY_CHART_PATH}"
    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": stock_code,
        "FID_INPUT_DATE_1": start_date,
        "FID_INPUT_DATE_2": end_date,
        "FID_PERIOD_DIV_CODE": "D",
        "FID_ORG_ADJ_PRC": "0" if adj_price else "1",
    }
    headers = get_headers(_DAILY_CHART_TR_ID)
    res = requests.get(url, headers=headers, params=params, timeout=10)
    res.raise_for_status()
    data = res.json()

    rows = data.get("output2", [])
    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df = df.rename(
        columns={
            "stck_bsop_date": "date",
            "stck_oprc": "open",
            "stck_hgpr": "high",
            "stck_lwpr": "low",
            "stck_clpr": "close",
            "acml_vol": "volume",
        }
    )[["date", "open", "high", "low", "close", "volume"]]

    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = df[col].astype(float)

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    return df
