import { NextResponse } from "next/server";
import {
  engineConfigured,
  acquireLock,
  releaseLock,
  kvGet,
  kvSet,
  KEYS,
} from "@/lib/store";
import { advanceOneStage, capReached, MIN_INTERVAL_MS } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// One tick advances the current investigation by one stage, gated by:
//  - engine configured (key + storage present)
//  - minimum interval since last tick
//  - a non-overlapping lock (so concurrent visitors can't double-run)
//  - the daily spend cap
// Driven by page traffic (and the daily cron backstop in vercel.json).
async function handle() {
  if (!engineConfigured) {
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  // Cheap pre-check before taking the lock.
  const lastTick = await kvGet<string>(KEYS.lastTick);
  if (lastTick && Date.now() - new Date(lastTick).getTime() < MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, reason: "too_soon", skipped: true });
  }

  const gotLock = await acquireLock(25_000);
  if (!gotLock) {
    return NextResponse.json({ ok: true, reason: "locked", skipped: true });
  }

  try {
    // Re-check interval and cap under the lock.
    const last2 = await kvGet<string>(KEYS.lastTick);
    if (last2 && Date.now() - new Date(last2).getTime() < MIN_INTERVAL_MS) {
      return NextResponse.json({ ok: true, reason: "too_soon", skipped: true });
    }
    if (await capReached()) {
      return NextResponse.json({ ok: true, reason: "cap_reached", skipped: true });
    }

    const result = await advanceOneStage();
    await kvSet(KEYS.lastTick, new Date().toISOString());
    return NextResponse.json({
      ok: true,
      advanced: true,
      stage: result.investigation.stages.slice(-1)[0]?.kind,
      completed: result.completed,
      spentUsd: Number(result.spentUsd.toFixed(5)),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: "error", detail: String(err) },
      { status: 500 }
    );
  } finally {
    await releaseLock();
  }
}

export async function GET() {
  return handle();
}
export async function POST() {
  return handle();
}
