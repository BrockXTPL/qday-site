import { NextResponse } from "next/server";
import { buildState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await buildState();
    return NextResponse.json(state, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "state_failed", detail: String(err) },
      { status: 500 }
    );
  }
}
