"use client";

import { useEffect, useRef, useState } from "react";
import { AGENTS, agentById, EXPOSURE } from "@/lib/data";
import type { LiveState, Investigation, StageKind } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/types";

const STAGE_LABEL: Record<StageKind, string> = {
  identify: "The vulnerability",
  analyze: "How it works",
  mitigate: "The fix",
  code: "Code fix",
  critique: "Reality check",
  letter: "Letter to the dev team",
};

// Parse a LANG/VULNERABLE/RECOMMENDED/NOTE code-stage payload.
function parseCode(text: string) {
  const grab = (label: string) => {
    const m = text.match(new RegExp(`${label}:\\s*(.+)`, "i"));
    return m ? m[1].trim() : "";
  };
  const between = (a: string, b: string) => {
    const re = new RegExp(`${a}:\\s*([\\s\\S]*?)(?:\\n${b}:|$)`, "i");
    const m = text.match(re);
    return m ? m[1].replace(/^\n+|\n+$/g, "") : "";
  };
  return {
    lang: grab("LANG") || "code",
    vulnerable: between("VULNERABLE", "RECOMMENDED"),
    recommended: between("RECOMMENDED", "NOTE"),
    note: grab("NOTE"),
  };
}

function CodeDiff({ text }: { text: string }) {
  const c = parseCode(text);
  if (!c.vulnerable && !c.recommended) {
    return <pre className="lc-letter">{text}</pre>;
  }
  return (
    <div className="codeblock">
      <div className="code-lang mono">{c.lang}</div>
      {c.vulnerable && (
        <div className="code-col bad">
          <div className="code-h mono">− vulnerable</div>
          <pre>{c.vulnerable}</pre>
        </div>
      )}
      {c.recommended && (
        <div className="code-col good">
          <div className="code-h mono">+ recommended</div>
          <pre>{c.recommended}</pre>
        </div>
      )}
      {c.note && <div className="code-note">{c.note}</div>}
    </div>
  );
}

type Tab = "live" | "solved" | "letters" | "advice" | "docs";

const ROADMAP = [
  {
    h: "Operational hygiene first",
    p: "Seeds generated on hardware that has never been online, never typed into a website or tool, never reused from a secondhand wallet. This is where funds are actually lost today — it outranks every speculative fix.",
  },
  {
    h: "Move cold funds into hash-based storage",
    p: "Solana's Winternitz Vault provides hash-based, curve-free signatures with a fresh one-time key per spend. For long-term holdings it removes elliptic-curve exposure entirely, with size and UX as the trade-off.",
  },
  {
    h: "Track protocol-level migration",
    p: "Key rotation and zero-knowledge ownership proofs would let a chain swap vulnerable verification for curve-resistant verification while keeping existing addresses. Not shippable by end users yet — watch core-dev channels.",
  },
  {
    h: "Don't rush address migration",
    p: "On Solana the address is the public key, so 'move to a fresh address' provides no curve protection. A rushed migration adds phishing and key-handling risk for zero cryptographic gain.",
  },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
function ac(agentId: string) {
  return `var(${agentById(agentId)?.accent || "--muted"})`;
}
function barColor(pct: number) {
  if (pct >= 70) return "var(--coral)";
  if (pct >= 40) return "var(--amber)";
  if (pct >= 20) return "var(--gold)";
  return "var(--accent-lattice)";
}
function clock(iso: string): string {
  return new Date(iso).toISOString().slice(11, 19);
}

// inline **bold** rendering
function inlineBold(line: string, k: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={`${k}-${i}`}>{p}</span>
    )
  );
}
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="rich">
      {lines.map((ln, i) =>
        ln.trim() === "" ? (
          <div key={i} className="rich-gap" />
        ) : (
          <p key={i} className="rich-line">
            {inlineBold(ln, String(i))}
          </p>
        )
      )}
    </div>
  );
}

// typewriter reveal for freshly-landed text
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const step = Math.max(1, Math.round(text.length / 90)); // ~finish in ~1.8s
    const id = setInterval(() => {
      setN((prev) => {
        if (prev >= text.length) {
          clearInterval(id);
          return prev;
        }
        return Math.min(text.length, prev + step);
      });
    }, 20);
    return () => clearInterval(id);
  }, [text]);
  const done = n >= text.length;
  return (
    <span>
      {text.slice(0, n)}
      {!done && <span className="tw-caret" />}
    </span>
  );
}

interface Evt {
  at: string;
  agentId: string;
  kind: StageKind;
  title: string;
}
const EVT_VERB: Record<StageKind, string> = {
  identify: "flagged a vulnerability in",
  analyze: "broke down the mechanism of",
  mitigate: "drafted a fix for",
  code: "wrote a code fix for",
  critique: "pressure-tested",
  letter: "wrote to the dev team re",
};
function collectEvents(state: LiveState): Evt[] {
  const all = [state.current, ...state.archive].filter(
    Boolean
  ) as Investigation[];
  const evts: Evt[] = [];
  for (const inv of all) {
    for (const s of inv.stages) {
      evts.push({ at: s.at, agentId: s.agentId, kind: s.kind, title: inv.title });
    }
  }
  evts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return evts.slice(0, 16);
}

export default function LiveConsole() {
  const [state, setState] = useState<LiveState | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<Tab>("live");
  const tickBusy = useRef(false);

  async function loadState() {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setState(await r.json());
      setErr(false);
    } catch {
      setErr(true);
    }
  }
  async function poke() {
    if (tickBusy.current) return;
    tickBusy.current = true;
    try {
      await fetch("/api/tick", { method: "POST", cache: "no-store" });
    } catch {
      /* ignore */
    } finally {
      tickBusy.current = false;
    }
  }

  useEffect(() => {
    loadState();
    const poll = setInterval(loadState, 4000);
    poke();
    const ticker = setInterval(poke, 12000);
    return () => {
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, []);

  if (!state) {
    return (
      <div className="lc-loading mono">
        {err ? "connection lost — retrying…" : "establishing uplink…"}
      </div>
    );
  }

  const letters = collectLetters(state);
  const counts: Record<Tab, number | null> = {
    live: null,
    solved: state.archive.length,
    letters: letters.length,
    advice: null,
    docs: null,
  };
  const TABS: { id: Tab; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "solved", label: "Solved" },
    { id: "letters", label: "Letters" },
    { id: "advice", label: "Advice" },
    { id: "docs", label: "Docs" },
  ];

  return (
    <div className="lc">
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.id === "live" && <span className="livedot" />}
            {t.label}
            {counts[t.id] != null && (
              <span className="tab-count">{counts[t.id]}</span>
            )}
          </button>
        ))}
      </nav>

      {!state.live && <div className="lc-banner mono">{state.note}</div>}
      {state.live && state.note && (
        <div className="lc-banner rest mono">{state.note}</div>
      )}

      {tab === "live" && <LiveTab state={state} />}
      {tab === "solved" && <SolvedTab archive={state.archive} />}
      {tab === "letters" && <LettersTab letters={letters} />}
      {tab === "advice" && <AdviceTab />}
      {tab === "docs" && <DocsTab />}
    </div>
  );
}

/* ---------- LIVE ---------- */
function StatsStrip({ state }: { state: LiveState }) {
  const s = state.stats;
  const tiles = [
    { n: String(s.investigations), l: "investigations closed", c: "var(--bone)" },
    { n: String(s.letters), l: "letters sent", c: "var(--accent-lattice)" },
    {
      n: "$" + s.spentTotalUsd.toFixed(2),
      l: "total researched",
      c: "var(--accent-cipher)",
    },
    {
      n: timeAgo(s.lastActivity),
      l: "last activity",
      c: s.lastActivity ? "var(--signal)" : "var(--faint)",
    },
  ];
  return (
    <div className="statstrip">
      {tiles.map((t, i) => (
        <div className="stile" key={i}>
          <div className="n mono" style={{ color: t.c }}>
            {t.n}
          </div>
          <div className="l mono">{t.l}</div>
        </div>
      ))}
    </div>
  );
}

function SignalLog({ state }: { state: LiveState }) {
  const evts = collectEvents(state);
  return (
    <div className="siglog">
      <div className="siglog-head mono">
        <span className="livedot" /> SIGNAL LOG
      </div>
      <div className="siglog-body mono">
        <div className="siglog-cursor">
          <span className="caret" /> monitoring research cell…
        </div>
        {evts.map((e, i) => {
          const agent = agentById(e.agentId)!;
          return (
            <div className="siglog-line" key={i}>
              <span className="t">{clock(e.at)}</span>
              <span className="who" style={{ color: ac(e.agentId) }}>
                {agent.handle}
              </span>
              <span className="v">{EVT_VERB[e.kind]}</span>
              <span className="ti">
                &ldquo;{e.title.length > 46 ? e.title.slice(0, 46) + "…" : e.title}
                &rdquo;
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveTab({ state }: { state: LiveState }) {
  return (
    <>
      <StatsStrip state={state} />
      <div className="lc-agents">
        {AGENTS.map((a) => {
          const st = state.agents.find((x) => x.agentId === a.id);
          const active = st?.active;
          return (
            <div
              key={a.id}
              className={`lc-agent${active ? " on" : ""}`}
              style={{ ["--ac" as string]: ac(a.id) }}
            >
              <div className="lc-agent-top">
                <span className="glyph">{a.avatar}</span>
                <span className="handle">{a.handle}</span>
                <span className={`dot${active ? " live" : ""}`} />
              </div>
              <div className="lc-agent-state">
                {active ? (
                  <span className="doing">
                    {st?.state}
                    <i className="ellip" />
                  </span>
                ) : (
                  <span className="muted">{st?.state || "idle"}</span>
                )}
              </div>
              <div className="lc-agent-last mono">
                last: {timeAgo(st?.lastActive || null)}
              </div>
            </div>
          );
        })}
      </div>
      {state.current ? (
        <ActiveInvestigation inv={state.current} agents={state.agents} />
      ) : (
        <div className="lc-empty mono">spinning up the next investigation…</div>
      )}
      <SignalLog state={state} />
    </>
  );
}

function ActiveInvestigation({
  inv,
  agents,
}: {
  inv: Investigation;
  agents: LiveState["agents"];
}) {
  const doneKinds = inv.stages.map((s) => s.kind);
  const nextStage = STAGE_ORDER[inv.stages.length];
  const pendingAgent = nextStage
    ? agents.find((a) => a.agentId === nextStage.agentId)
    : null;
  const newestKind = inv.stages.length
    ? inv.stages[inv.stages.length - 1].kind
    : null;

  return (
    <div className="lc-active">
      <div className="lc-active-head">
        <span className="tag mono">● ACTIVE INVESTIGATION</span>
        <span className={`sev ${inv.severity}`}>
          {inv.severity.toUpperCase()}
        </span>
      </div>
      <h3 className="lc-title">{inv.title}</h3>
      <div className="lc-chain mono">{inv.chain}</div>

      {inv.objective && (
        <div className="lc-objective">
          <span className="lbl mono">OBJECTIVE</span>
          <p>{inv.objective}</p>
        </div>
      )}

      <div className="lc-stages">
        {STAGE_ORDER.map((so) => {
          const stage = inv.stages.find((s) => s.kind === so.kind);
          const isDone = doneKinds.includes(so.kind);
          const isNext = nextStage?.kind === so.kind;
          const agent = agentById(so.agentId)!;
          const isLetter = so.kind === "letter";
          const isCode = so.kind === "code";
          return (
            <div
              key={so.kind}
              className={`lc-stage${isDone ? " done" : ""}${
                isNext ? " next" : ""
              }`}
              style={{ ["--ac" as string]: ac(so.agentId) }}
            >
              <div className="lc-stage-rail">
                <span className="node" />
              </div>
              <div className="lc-stage-body">
                <div className="lc-stage-label mono">
                  <span className="who">{agent.handle}</span>
                  <span className="sep">·</span>
                  <span>{STAGE_LABEL[so.kind]}</span>
                </div>
                {isDone ? (
                  isLetter ? (
                    <div className="lc-letter rich-wrap">
                      <RichText text={stage!.text} />
                    </div>
                  ) : isCode ? (
                    <CodeDiff text={stage!.text} />
                  ) : so.kind === newestKind ? (
                    <p key={`${inv.id}-${so.kind}`}>
                      <Typewriter text={stage!.text} />
                    </p>
                  ) : (
                    <p>{stage!.text}</p>
                  )
                ) : isNext ? (
                  <p className="working">
                    {agent.handle} is {pendingAgent?.state || so.doing}
                    <i className="ellip" />
                  </p>
                ) : (
                  <p className="queued">queued</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- SOLVED ---------- */
function SolvedTab({ archive }: { archive: Investigation[] }) {
  if (archive.length === 0)
    return (
      <div className="lc-empty mono">
        No closed investigations yet — the first one is in progress on the Live
        tab.
      </div>
    );
  return (
    <div className="lc-archive">
      {archive.map((inv) => (
        <ArchiveRow key={inv.id} inv={inv} />
      ))}
    </div>
  );
}

function ArchiveRow({ inv }: { inv: Investigation }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lc-arow${open ? " open" : ""}`}>
      <button className="lc-arow-head" onClick={() => setOpen((o) => !o)}>
        <span className={`sev ${inv.severity}`}>
          {inv.severity.charAt(0).toUpperCase()}
        </span>
        <span className="lc-arow-title">{inv.title}</span>
        <span className="lc-arow-chain mono">{inv.chain}</span>
        <span className="lc-arow-caret">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="lc-arow-body">
          {inv.objective && (
            <div className="lc-objective sm">
              <span className="lbl mono">OBJECTIVE</span>
              <p>{inv.objective}</p>
            </div>
          )}
          {inv.stages.map((s, i) => {
            const agent = agentById(s.agentId)!;
            return (
              <div
                key={i}
                className="lc-arow-stage"
                style={{ ["--ac" as string]: ac(s.agentId) }}
              >
                <div className="lc-stage-label mono">
                  <span className="who">{agent.handle}</span>
                  <span className="sep">·</span>
                  <span>{STAGE_LABEL[s.kind]}</span>
                </div>
                {s.kind === "letter" ? (
                  <div className="lc-letter rich-wrap">
                    <RichText text={s.text} />
                  </div>
                ) : s.kind === "code" ? (
                  <CodeDiff text={s.text} />
                ) : (
                  <p>{s.text}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- LETTERS ---------- */
interface LetterItem {
  id: string;
  title: string;
  chain: string;
  text: string;
  at: string;
}
function collectLetters(state: LiveState): LetterItem[] {
  const all = [state.current, ...state.archive].filter(
    Boolean
  ) as Investigation[];
  const out: LetterItem[] = [];
  for (const inv of all) {
    const l = inv.stages.find((s) => s.kind === "letter");
    if (l)
      out.push({
        id: inv.id,
        title: inv.title,
        chain: inv.chain,
        text: l.text,
        at: l.at,
      });
  }
  return out;
}
function LettersTab({ letters }: { letters: LetterItem[] }) {
  if (letters.length === 0)
    return (
      <div className="lc-empty mono">
        No letters drafted yet. The cell writes one to the relevant dev team
        after it finishes an investigation.
      </div>
    );
  return (
    <div className="letters">
      <p className="tab-intro">
        After each investigation, the cell drafts an open letter to the team
        that could ship the fix. Commentary, not official disclosure.
      </p>
      {letters.map((l, i) => (
        <div key={l.id} className="letter-card">
          <div className="letter-head">
            <span className="letter-tag mono">
              OPEN LETTER №{String(letters.length - i).padStart(3, "0")}
            </span>
            <span className="letter-date mono">
              {new Date(l.at).toISOString().slice(0, 10)}
            </span>
          </div>
          <div className="letter-meta mono">
            <span className="re">RE: {l.title}</span>
            <span className="ch">{l.chain}</span>
          </div>
          <div className="letter-body rich-wrap">
            <RichText text={l.text} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- ADVICE ---------- */
const SECURE_DEFAULTS = [
  {
    title: "Deterministic ECDSA nonces",
    text: "LANG: python\nVULNERABLE:\nk = random.randint(1, n - 1)\nr, s = ecdsa_sign(msg, privkey, k)\nRECOMMENDED:\nk = rfc6979_nonce(msg, privkey)\nr, s = ecdsa_sign(msg, privkey, k)\nNOTE: RFC 6979 removes RNG dependence, closing the most common real-world key-leak path.",
  },
  {
    title: "Hash-based cold storage",
    text: "LANG: rust\nVULNERABLE:\nlet sig = ed25519_sign(msg, secret_key);\nsubmit(tx, sig);\nRECOMMENDED:\nlet wots = winternitz_keypair();\nvault_deposit(amount, wots.public);\nNOTE: Hash-based one-time keys carry no elliptic-curve structure for a future break to exploit.",
  },
  {
    title: "Never reuse an address",
    text: "LANG: pseudocode\nVULNERABLE:\naddr = wallet.main_address   // reused every receive\nreceive(addr)\nRECOMMENDED:\naddr = wallet.derive_next()  // fresh per receive\nreceive(addr)\nNOTE: One address per receipt limits how long any public key sits exposed on-chain.",
  },
];

function AdviceTab() {
  return (
    <div className="advice">
      <p className="tab-intro">
        Where the three agents agree, it lands here — ranked by protection per
        unit of effort. This is what the cell actually recommends holders do
        today.
      </p>
      <div className="road">
        {ROADMAP.map((step, i) => (
          <div className="road-step" key={i}>
            <div className="idx">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <h4>{step.h}</h4>
              <p>{step.p}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="secure-defaults">
        <h4 className="sd-head">Secure coding defaults</h4>
        <p className="tab-intro">
          Drop-in patterns builders can adopt today. Illustrative snippets, not
          exploit code.
        </p>
        {SECURE_DEFAULTS.map((d) => (
          <div className="sd-item" key={d.title}>
            <div className="sd-title">{d.title}</div>
            <CodeDiff text={d.text} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- DOCS ---------- */
function DocsTab() {
  return (
    <div className="docs">
      <section className="doc-sec">
        <h4>How it works</h4>
        <p>
          A research cycle advances one stage at a time. CIPHER-0 picks a
          publicly-documented weakness and explains the mechanism; LATTICE-7
          proposes the standard published defense; ORACLE-9 pressure-tests
          whether the threat and the fix are real; then LATTICE-7 drafts a
          letter to the relevant development team. The cell works on known,
          public cryptography — it does not discover novel exploits or touch
          live wallets.
        </p>
      </section>

      <section className="doc-sec">
        <h4>The agents</h4>
        <div className="doc-agents">
          {AGENTS.map((a) => (
            <div
              key={a.id}
              className="doc-agent"
              style={{ ["--ac" as string]: ac(a.id) }}
            >
              <span className="handle mono">
                {a.avatar} {a.handle}
              </span>
              <span className="role">{a.role}</span>
              <p>{a.stance}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="doc-sec">
        <h4>Exposure index</h4>
        <p className="doc-note">
          Relative ranking of how exposed each signature scheme is to a curve
          break, by how readily the public key is visible on-chain.
          Illustrative — not a probability of loss.
        </p>
        <div className="exposure">
          {EXPOSURE.map((row) => (
            <div className="expo-row" key={row.chain}>
              <div>
                <div className="chain">{row.chain}</div>
                <div className="scheme">{row.scheme}</div>
              </div>
              <div className="bar">
                <i
                  style={{
                    width: `${row.exposure}%`,
                    background: barColor(row.exposure),
                  }}
                />
              </div>
              <div className="pct">{row.exposure}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
