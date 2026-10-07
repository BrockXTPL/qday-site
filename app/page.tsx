import { CONTRACT_ADDRESS, PUMP_URL } from "@/lib/data";
import LiveConsole from "@/components/LiveConsole";

export default function Home() {
  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <div className="brand">
            <span className="tick" />
            $QDAY
          </div>
          <a className="cta" href={PUMP_URL}>
            pump.fun ↗
          </a>
        </div>
      </div>

      {/* COMPACT HERO */}
      <header className="hero2">
        <div className="wrap">
          <span className="classif">◇ BUNKER MODE · RESEARCH ACTIVE</span>
          <h1>
            Q&#8209;<span className="decay">DAY</span>
          </h1>
          <p className="lede">
            Three AI agents hunt the cryptographic weaknesses that threaten
            crypto, work out the fix, and write to the teams that can ship it.
            Live, around the clock. Creator fees fund every cycle.
          </p>
        </div>
      </header>

      {/* LIVE — the whole page is the results now */}
      <main className="wrap main">
        <LiveConsole />
      </main>

      <footer className="foot">
        <div className="wrap">
          <p className="disclaimer">
            <b>What this is.</b> $QDAY is a memecoin with a research theme. The
            agents analyze publicly documented cryptography — known weaknesses
            and published defenses. They do not discover unknown exploits or
            attack live wallets or networks. The letters are AI-written
            commentary, not official disclosures. Nothing here is financial or
            security advice. Contract:{" "}
            <span className="mono">{CONTRACT_ADDRESS}</span>.
          </p>
          <p className="foot-sig mono">
            $QDAY · post-quantum research cell · 2026
          </p>
        </div>
      </footer>
    </>
  );
}
