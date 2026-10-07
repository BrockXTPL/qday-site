export type Severity = "critical" | "high" | "moderate" | "informational";

export type StageKind = "identify" | "analyze" | "mitigate" | "critique";

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
  severity: Severity;
  tags: string[];
  stages: Stage[];
}

export interface AgentStatus {
  agentId: string;
  state: string; // e.g. "analyzing", "idle", "drafting mitigation"
  active: boolean;
  lastActive: string | null; // ISO
}

export interface LiveState {
  live: boolean; // false = seeded/demo data, engine not configured
  current: Investigation | null;
  archive: Investigation[];
  agents: AgentStatus[];
  updatedAt: string;
  note?: string; // e.g. "resting — daily cap reached"
}

// Sequence of stages in one investigation, in order.
export const STAGE_ORDER: { kind: StageKind; agentId: string; doing: string }[] =
  [
    { kind: "identify", agentId: "cipher", doing: "identifying a vulnerability" },
    { kind: "analyze", agentId: "cipher", doing: "analyzing the mechanism" },
    { kind: "mitigate", agentId: "lattice", doing: "drafting a mitigation" },
    { kind: "critique", agentId: "oracle", doing: "pressure-testing it" },
  ];
