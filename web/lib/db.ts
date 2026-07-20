import { neon, NeonQueryFunction } from "@neondatabase/serverless";

// Vercel Postgres(Neon) 연동 시 자동으로 주입되는 환경변수
// 빌드 타임(page data collection 등)에는 env가 없을 수 있어 최초 쿼리 시점에 지연 생성한다.
let client: NeonQueryFunction<false, false> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) {
      throw new Error("DATABASE_URL(또는 POSTGRES_URL) 환경변수가 설정되지 않았습니다");
    }
    client = neon(url);
  }
  return client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getClient()(strings, ...values);
}

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

let initialized = false;

/** 최초 호출 시 필요한 테이블을 생성한다 (idempotent) */
export async function ensureSchema() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS kis_token (
      id INT PRIMARY KEY DEFAULT 1,
      access_token TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS positions (
      stock_code TEXT PRIMARY KEY,
      stock_name TEXT,
      qty INT NOT NULL,
      avg_price NUMERIC NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      stock_code TEXT NOT NULL,
      stock_name TEXT,
      side TEXT NOT NULL,
      qty INT NOT NULL,
      price NUMERIC NOT NULL,
      reason TEXT,
      order_no TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS signal_log (
      id SERIAL PRIMARY KEY,
      stock_code TEXT NOT NULL,
      stock_name TEXT,
      macd NUMERIC,
      macd_signal NUMERIC,
      macd_hist NUMERIC,
      ma5 NUMERIC,
      ma20 NUMERIC,
      signal TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`ALTER TABLE signal_log ADD COLUMN IF NOT EXISTS reason TEXT`;

  initialized = true;
}
