import type { Investigation, Severity, StageKind } from "./types";
import { STAGE_ORDER } from "./types";
import { topicForIndex } from "./topics";
import {
  KEYS,
  kvGet,
  kvSet,
  getSpend,
  addSpend,
  todayUTC,
  apiKey,
} from "./store";

const MODEL = "claude-haiku-4-5-20251001";
const PRICE_IN = 1 / 1_000_000; // $ per input token
const PRICE_OUT = 5 / 1_000_000; // $ per output token
const MAX_TOKENS = 320;

export const DAILY_USD_CAP = Number(process.env.DAILY_USD_CAP || "6");
export const MIN_INTERVAL_MS = Number(
  process.env.MIN_INTERVAL_SECONDS || "35"
) * 1000;

const ARCHIVE_MAX = 25;

const SYSTEM = `You are one of three AI research agents in QSHIELD (the Quantum Shield Protocol), a public post-quantum cryptocurrency-defense research cell. You analyze ONLY publicly documented, well-known cryptographic weakness classes and their standard, published defenses. Hard rules: never produce working exploit code, private keys, or step-by-step instructions to attack live systems or real wallets; never claim to have discovered a novel exploit; discuss mechanisms and mitigations at a conceptual level only. Be concrete, technical, and concise. No preamble, no sign-off. Under 75 words.`;

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

async function callClaude(
  userPrompt: string,
  maxTokens: number = MAX_TOKENS
): Promise<{ text: string; usage: AnthropicUsage }> {
  const key = apiKey();
  if (!key) throw new Error("API key missing");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string =
    data?.content?.[0]?.text?.trim() || "(no response)";
  const usage: AnthropicUsage = data?.usage || {
    input_tokens: 0,
    output_tokens: 0,
  };
  return { text, usage };
}

function costOf(u: AnthropicUsage): number {
  return u.input_tokens * PRICE_IN + u.output_tokens * PRICE_OUT;
}

function parseIdentify(raw: string): {
  title: string;
  chain: string;
  objective: string;
  severity: Severity;
  body: string;
} {
  const grab = (label: string) => {
    const m = raw.match(new RegExp(`${label}:\\s*(.+)`, "i"));
    return m ? m[1].trim() : "";
  };
  const sevRaw = grab("SEVERITY").toLowerCase();
  const severity: Severity = (
    ["critical", "high", "moderate", "informational"] as Severity[]
  ).includes(sevRaw as Severity)
    ? (sevRaw as Severity)
    : "moderate";
  let body = grab("BODY");
  if (!body) {
    // Fall back: strip the labelled lines, keep the rest.
    body = raw
      .replace(/TITLE:.*/i, "")
      .replace(/CHAIN:.*/i, "")
      .replace(/SEVERITY:.*/i, "")
      .replace(/BODY:/i, "")
      .trim();
  }
  return {
    title: grab("TITLE") || "Cryptographic exposure under review",
    chain: grab("CHAIN") || "multiple chains",
    objective: grab("OBJECTIVE") || "",
    severity,
    body: body || raw,
  };
}

function tagsFrom(text: string): string[] {
  const pool = [
    "ecdsa",
    "ed25519",
    "secp256k1",
    "curve25519",
    "nonce",
    "rfc6979",
    "wots",
    "sphincs+",
    "hash-based",
    "zk",
    "shor",
    "grover",
    "solana",
    "bitcoin",
    "ethereum",
    "migration",
    "exposure",
    "quantum",
  ];
  const low = text.toLowerCase();
  const hits = pool.filter((t) => low.includes(t));
  return hits.slice(0, 4);
}

// Advance the current investigation by exactly one stage.
// Returns the updated investigation and the $ spent on this step.
export async function advanceOneStage(): Promise<{
  investigation: Investigation;
  spentUsd: number;
  completed: boolean;
}> {
  let current = await kvGet<Investigation>(KEYS.current);
  const nowIso = new Date().toISOString();

  // Start a new investigation if none active or the last one is complete.
  const needNew =
    !current || current.stages.length >= STAGE_ORDER.length;

  if (needNew) {
    // Archive the finished one first.
    if (current && current.stages.length >= STAGE_ORDER.length) {
      current.status = "archived";
      const archive =
        (await kvGet<Investigation[]>(KEYS.archive)) || [];
      archive.unshift(current);
      await kvSet(KEYS.archive, archive.slice(0, ARCHIVE_MAX));
    }
    const idx = (await kvGet<number>(KEYS.topicIndex)) || 0;
    const topic = topicForIndex(idx);
    await kvSet(KEYS.topicIndex, idx + 1);

    const prompt = `Topic for this cycle: ${topic}.
As CIPHER-0 (curve & signature analyst), identify ONE concrete, publicly-documented cryptographic exposure within this topic.
Respond EXACTLY in this format:
TITLE: <under 9 words>
CHAIN: <affected chains / signature scheme>
SEVERITY: <critical|high|moderate>
OBJECTIVE: <one plain-English sentence a non-expert understands: what this investigation is trying to accomplish>
BODY: <why it matters, under 55 words>`;
    const { text, usage } = await callClaude(prompt);
    const parsed = parseIdentify(text);
    current = {
      id: `inv-${Date.now()}`,
      startedAt: nowIso,
      status: "active",
      title: parsed.title,
      chain: parsed.chain,
      objective:
        parsed.objective ||
        `Work out whether ${topic} is a real risk and what defends against it.`,
      severity: parsed.severity,
      tags: tagsFrom(text + " " + topic),
      stages: [
        {
          kind: "identify",
          agentId: "cipher",
          text: parsed.body,
          at: nowIso,
        },
      ],
    };
    await kvSet(KEYS.current, current);
    const spent = costOf(usage);
    await addSpend(spent);
    return { investigation: current, spentUsd: spent, completed: false };
  }

  // Otherwise, run the next stage in order.
  if (!current) throw new Error("no active investigation");
  const nextStage = STAGE_ORDER[current.stages.length];
  const prior = current.stages
    .map((s) => `[${s.kind.toUpperCase()} by ${s.agentId}] ${s.text}`)
    .join("\n");

  const prompts: Record<StageKind, string> = {
    identify: "",
    analyze: `Investigation so far:\n${prior}\n\nAs CIPHER-0, think out loud and explain HOW this exposure works — the mechanism, conceptually, in plain technical terms. No exploit code. Under 70 words.`,
    mitigate: `Investigation so far:\n${prior}\n\nAs LATTICE-7 (post-quantum defense architect), propose the standard, published defense(s). Name concrete schemes (hash-based signatures, WOTS, SPHINCS+, ZK proofs, RFC 6979, key rotation, etc.) and the trade-off. Under 70 words.`,
    critique: `Investigation so far:\n${prior}\n\nAs ORACLE-9 (threat-model skeptic), pressure-test it: how realistic is this threat today, does the proposed defense actually hold, and what's the catch? Under 70 words.`,
    letter: `Investigation so far:\n${prior}\n\nAs LATTICE-7, write a detailed, professional open letter to the development team behind the affected chain or infrastructure about this well-documented exposure.
Structure it exactly as:
- A greeting line, e.g. "To the <specific team> developers,"
- One paragraph stating the exposure and why it matters, in concrete technical terms.
- One paragraph on real-world impact and current status (is it already mitigated anywhere, who is affected).
- A line "We recommend:" followed by a numbered list of 3-4 concrete, actionable recommendations, each naming specific schemes/standards (RFC 6979, WOTS, SPHINCS+, ZK proofs, key rotation, etc.) in **bold**.
- A closing line offering collaboration, and the sign-off "— The QSHIELD research cell".
Constructive, factual, specific, no alarmism, no exploit code. 150-200 words. Use **double asterisks** for emphasis on scheme names.`,
  };

  const letterMax = nextStage.kind === "letter" ? 600 : MAX_TOKENS;
  const { text, usage } = await callClaude(prompts[nextStage.kind], letterMax);
  current.stages.push({
    kind: nextStage.kind,
    agentId: nextStage.agentId,
    text,
    at: nowIso,
  });
  if (current.stages.some((s) => s.agentId === "lattice") && current.tags.length < 4) {
    current.tags = Array.from(new Set([...current.tags, ...tagsFrom(text)])).slice(0, 4);
  }
  await kvSet(KEYS.current, current);
  const spent = costOf(usage);
  await addSpend(spent);
  const completed = current.stages.length >= STAGE_ORDER.length;
  return { investigation: current, spentUsd: spent, completed };
}

export async function capReached(): Promise<boolean> {
  const spend = await getSpend();
  return spend.day === todayUTC() && spend.usd >= DAILY_USD_CAP;
}
