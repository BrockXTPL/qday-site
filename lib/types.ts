export type Severity = "critical" | "high" | "moderate" | "informational";

export type StageKind =
  | "identify"
  | "analyze"
  | "mitigate"
  | "code"
  | "critique"
  | "letter";

export interface Stage {
  kind: StageKind;
  agentId: string;
  text: string;
  at: string; // ISO
}

export interface Investigation {
  id: string;
  startedAt: string;
  status: "active" | "archived";
  title: string;
  chain: string;
  objective: string; // plain-English: what this investigation is trying to accomplish
  severity: Severity;
  tags: string[];
  stages: Stage[];
}

export interface AgentStatus {
  agentId: string;
  state: string; // e.g. "analyzing", "idle", "drafting the letter"
  active: boolean;
  lastActive: string | null; // ISO
}

export interface LiveStats {
  investigations: number; // closed investigations
  letters: number; // letters drafted (current + archive)
  spentTodayUsd: number; // research spend so far today (UTC)
  spentTotalUsd: number; // baseline + lifetime research spend
  lastActivity: string | null; // ISO of last tick
}

export interface LiveState {
  live: boolean; // false = seeded/demo data, engine not configured
  current: Investigation | null;
  archive: Investigation[];
  agents: AgentStatus[];
  stats: LiveStats;
  updatedAt: string;
  note?: string;
}

// Sequence of stages in one investigation, in order.
export const STAGE_ORDER: {
  kind: StageKind;
  agentId: string;
  doing: string;
}[] = [
  { kind: "identify", agentId: "cipher", doing: "identifying a vulnerability" },
  { kind: "analyze", agentId: "cipher", doing: "analyzing the mechanism" },
  { kind: "mitigate", agentId: "lattice", doing: "drafting a mitigation" },
  { kind: "code", agentId: "lattice", doing: "writing the code fix" },
  { kind: "critique", agentId: "oracle", doing: "pressure-testing it" },
  { kind: "letter", agentId: "lattice", doing: "writing the dev-team letter" },
];
