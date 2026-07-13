"""
KIS(한국투자증권) Open API 인증 모듈
- 접근토큰(access_token) 발급 및 로컬 캐시
- 모의투자 / 실전투자 도메인은 config.BASE_URL에서 이미 분기됨
"""
import json
import time
from datetime import datetime
from pathlib import Path

import requests

from config import APP_KEY, APP_SECRET, BASE_URL

_TOKEN_CACHE_PATH = Path(__file__).parent / "token_cache.json"


def _load_cached_token():
    """캐시된 토큰이 유효(만료 10분 전)하면 반환, 아니면 None"""
    if not _TOKEN_CACHE_PATH.exists():
        return None
    try:
        data = json.loads(_TOKEN_CACHE_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return None

    expires_at = data.get("expires_at", 0)
    if time.time() < expires_at - 600:
        return data.get("access_token")
    return None


def _save_token_cache(access_token: str, expires_in: int) -> None:
    data = {
        "access_token": access_token,
        "expires_at": time.time() + expires_in,
        "issued_at": datetime.now().isoformat(),
    }
    _TOKEN_CACHE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def issue_access_token() -> str:
    """KIS 접근토큰 신규 발급 (POST /oauth2/tokenP)"""
    url = f"{BASE_URL}/oauth2/tokenP"
    body = {
        "grant_type": "client_credentials",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
    }
    res = requests.post(url, json=body, timeout=10)
    res.raise_for_status()
    data = res.json()

    access_token = data["access_token"]
    expires_in = int(data.get("expires_in", 86400))
    _save_token_cache(access_token, expires_in)
    return access_token


def get_access_token() -> str:
    """캐시된 토큰이 유효하면 재사용하고, 아니면 새로 발급받는다"""
    cached = _load_cached_token()
    if cached:
        return cached
    return issue_access_token()


def get_headers(tr_id: str, extra: dict | None = None) -> dict:
    """API 요청 공통 헤더 빌더"""
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {get_access_token()}",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
        "tr_id": tr_id,
        "custtype": "P",
    }
    if extra:
        headers.update(extra)
    return headers
