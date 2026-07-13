"""보조지표 계산 - MACD"""
import pandas as pd

from config import MACD_FAST, MACD_SIGNAL, MACD_SLOW


def calculate_macd(
    df: pd.DataFrame,
    fast: int = MACD_FAST,
    slow: int = MACD_SLOW,
    signal: int = MACD_SIGNAL,
    price_col: str = "close",
) -> pd.DataFrame:
    """MACD, Signal, Histogram 컬럼을 추가한 DataFrame을 반환한다"""
    df = df.copy()
    ema_fast = df[price_col].ewm(span=fast, adjust=False).mean()
    ema_slow = df[price_col].ewm(span=slow, adjust=False).mean()

    df["macd"] = ema_fast - ema_slow
    df["macd_signal"] = df["macd"].ewm(span=signal, adjust=False).mean()
    df["macd_hist"] = df["macd"] - df["macd_signal"]
    return df
