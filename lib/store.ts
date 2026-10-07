import Redis from "ioredis";

// The Upstash/Vercel integration provides REDIS_URL (a rediss:// TCP string).
// The API key was saved under the name SECRET (fallback: ANTHROPIC_API_KEY).
const g = globalThis as unknown as { __qdayRedis?: Redis };

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!g.__qdayRedis) {
    g.__qdayRedis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    // Avoid unhandled 'error' events crashing the function.
    g.__qdayRedis.on("error", () => {});
  }
  return g.__qdayRedis;
}

export const redis = getRedis();
export const storageReady = redis !== null;

export function apiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.SECRET;
}
export const engineConfigured = storageReady && !!apiKey();

const K = {
  current: "qday:current",
  archive: "qday:archive",
  lastTick: "qday:lastTick",
  spend: "qday:spend",
  topicIndex: "qday:topicIndex",
  lock: "qday:lock",
};
export const KEYS = K;

// ioredis stores strings; we JSON-encode ourselves.
export async function kvGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  const v = await redis.get(key);
  if (v == null) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}
export async function kvSet(key: string, val: unknown): Promise<void> {
  if (!redis) return;
  await redis.set(key, JSON.stringify(val));
}

// Atomic lock: SET key val PX ms NX. Returns true if acquired.
export async function acquireLock(ms: number): Promise<boolean> {
  if (!redis) return false;
  const res = await redis.set(K.lock, String(Date.now()), "PX", ms, "NX");
  return res === "OK";
}
export async function releaseLock(): Promise<void> {
  if (!redis) return;
  await redis.del(K.lock);
}

export interface SpendRecord {
  day: string; // YYYY-MM-DD (UTC)
  usd: number;
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getSpend(): Promise<SpendRecord> {
  const rec = await kvGet<SpendRecord>(K.spend);
  const today = todayUTC();
  if (!rec || rec.day !== today) return { day: today, usd: 0 };
  return rec;
}

export async function addSpend(usd: number): Promise<SpendRecord> {
  const cur = await getSpend();
  const next = { day: cur.day, usd: cur.usd + usd };
  await kvSet(K.spend, next);
  return next;
}
