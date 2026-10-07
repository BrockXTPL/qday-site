import { Redis } from "@upstash/redis";

// Reads whichever env var pair the storage integration provided:
// Vercel KV uses KV_REST_API_URL / KV_REST_API_TOKEN;
// a raw Upstash integration uses UPSTASH_REDIS_REST_URL / _TOKEN.
function getRedis(): Redis | null {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export const redis = getRedis();
export const storageReady = redis !== null;
export const engineConfigured =
  storageReady && !!process.env.ANTHROPIC_API_KEY;

const K = {
  current: "qday:current",
  archive: "qday:archive",
  lastTick: "qday:lastTick",
  spend: "qday:spend",
  topicIndex: "qday:topicIndex",
  lock: "qday:lock",
};

// @upstash/redis auto-serializes JSON on set and parses on get.
export async function kvGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  return (await redis.get<T>(key)) ?? null;
}
export async function kvSet(key: string, val: unknown): Promise<void> {
  if (!redis) return;
  await redis.set(key, val);
}

export const KEYS = K;

// Atomic lock: SET key val NX PX=ms. Returns true if acquired.
export async function acquireLock(ms: number): Promise<boolean> {
  if (!redis) return false;
  const res = await redis.set(K.lock, Date.now(), { nx: true, px: ms });
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
