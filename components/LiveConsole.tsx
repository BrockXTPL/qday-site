"use client";

import { useEffect, useRef, useState } from "react";
import { AGENTS, agentById } from "@/lib/data";
import type { LiveState, Investigation, StageKind } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/types";

const STAGE_LABEL: Record<StageKind, string> = {
  identify: "The vulnerability",
  analyze: "How it works",
  mitigate: "The fix",
  critique: "Reality check",
  letter: "Letter to the dev team",
};

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

export default function LiveConsole() {
  const [state, setState] = useState<LiveState | null>(null);
  const [err, setErr] = useState(false);
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
    // Poke the engine while someone is watching; the server enforces the
    // real cadence and spend cap, so frequent pokes are harmless.
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

  const cur = state.current;

  return (
    <div className="lc">
      {!state.live && (
        <div className="lc-banner mono">{state.note}</div>
      )}
      {state.live && state.note && (
        <div className="lc-banner rest mono">{state.note}</div>
      )}

      {/* AGENT STATUS STRIP */}
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

      {/* ACTIVE INVESTIGATION */}
      {cur && <ActiveInvestigation inv={cur} agents={state.agents} />}

      {/* ARCHIVE */}
      {state.archive.length > 0 && (
        <div className="lc-archive">
          <div className="lc-archive-head mono">
            CLOSED INVESTIGATIONS · {state.archive.length}
          </div>
          {state.archive.map((inv) => (
            <ArchiveRow key={inv.id} inv={inv} />
          ))}
        </div>
      )}
    </div>
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

  return (
    <div className="lc-active">
      <div className="lc-active-head">
        <span className="tag mono">● ACTIVE INVESTIGATION</span>
        <span className={`sev ${inv.severity}`}>{inv.severity.toUpperCase()}</span>
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
                    <pre className="lc-letter">{stage!.text}</pre>
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
                  <pre className="lc-letter">{s.text}</pre>
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
