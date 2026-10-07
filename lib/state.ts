import type { Investigation, LiveState, AgentStatus } from "./types";
import { STAGE_ORDER } from "./types";
import { AGENTS } from "./data";
import { KEYS, kvGet, engineConfigured, getSpend } from "./store";
import { seedState } from "./seed";
import { DAILY_USD_CAP } from "./engine";

// Build the public LiveState from storage, or seed data if not configured.
export async function buildState(): Promise<LiveState> {
  if (!engineConfigured) return seedState();

  const current = await kvGet<Investigation>(KEYS.current);
  const archive = (await kvGet<Investigation[]>(KEYS.archive)) || [];
  const lastTick = (await kvGet<string>(KEYS.lastTick)) || null;
  const spend = await getSpend();
  const capped = spend.usd >= DAILY_USD_CAP;

  // Derive each agent's status from where the current investigation stands.
  const nextIdx = current ? current.stages.length : 0;
  const nextStage =
    !capped && nextIdx < STAGE_ORDER.length ? STAGE_ORDER[nextIdx] : null;

  const agents: AgentStatus[] = AGENTS.map((a) => {
    const lastStage = current?.stages
      .filter((s) => s.agentId === a.id)
      .slice(-1)[0];
    const isNext = nextStage?.agentId === a.id;
    return {
      agentId: a.id,
      state: capped
        ? "resting"
        : isNext
        ? nextStage!.doing
        : "idle",
      active: isNext,
      lastActive: lastStage?.at || null,
    };
  });

  return {
    live: true,
    current: current ?? null,
    archive,
    agents,
    updatedAt: lastTick || new Date().toISOString(),
    note: capped
      ? "Agents resting — daily research budget reached. Resumes tomorrow (UTC)."
      : undefined,
  };
}
