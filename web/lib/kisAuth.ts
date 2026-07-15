import { APP_KEY, APP_SECRET, BASE_URL } from "./config";
import { ensureSchema, sql } from "./db";

/**
 * KIS 접근토큰 발급/캐시
 * 서버리스 환경은 인스턴스 간 메모리 공유가 안 되므로 DB(kis_token 테이블)에 캐시한다.
 * KIS는 토큰 재발급 요청을 짧은 주기로 반복하면 제한이 걸릴 수 있어, 만료 10분 전까지는 재사용한다.
 */
async function loadCachedToken(): Promise<string | null> {
  await ensureSchema();
  const rows = await sql`SELECT access_token, expires_at FROM kis_token WHERE id = 1`;
  if (rows.length === 0) return null;

  const { access_token, expires_at } = rows[0] as {
    access_token: string;
    expires_at: string;
  };
  if (Date.now() < Number(expires_at) - 10 * 60 * 1000) {
    return access_token;
  }
  return null;
}

async function saveTokenCache(accessToken: string, expiresInSec: number) {
  const expiresAt = Date.now() + expiresInSec * 1000;
  await sql`
    INSERT INTO kis_token (id, access_token, expires_at)
    VALUES (1, ${accessToken}, ${expiresAt})
    ON CONFLICT (id) DO UPDATE SET access_token = EXCLUDED.access_token, expires_at = EXCLUDED.expires_at
  `;
}

async function issueAccessToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/oauth2/tokenP`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: APP_KEY,
      appsecret: APP_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(`KIS 토큰 발급 실패: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  await saveTokenCache(data.access_token, Number(data.expires_in ?? 86400));
  return data.access_token;
}

export async function getAccessToken(): Promise<string> {
  const cached = await loadCachedToken();
  if (cached) return cached;
  return issueAccessToken();
}

export async function getHeaders(trId: string, extra?: Record<string, string>) {
  return {
    "content-type": "application/json; charset=utf-8",
    authorization: `Bearer ${await getAccessToken()}`,
    appkey: APP_KEY,
    appsecret: APP_SECRET,
    tr_id: trId,
    custtype: "P",
    ...extra,
  };
}
