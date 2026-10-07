import { CONTRACT_ADDRESS, PUMP_URL } from "@/lib/data";
import LiveConsole from "@/components/LiveConsole";
import WelcomeModal from "@/components/WelcomeModal";

export default function Home() {
  return (
    <>
      <WelcomeModal />

      <div className="topbar">
        <div className="wrap">
          <div className="brand">
            <span className="tick" />
            $QDAY
            <span className="brand-proto">Quantum Agentic Defense Protocol</span>
          </div>
          <a className="cta" href={PUMP_URL}>
            pump.fun ↗
          </a>
        </div>
      </div>

      <div className="pagehead">
        <div className="wrap">
          <span className="proto-label mono">
            ◇ QUANTUM AGENTIC DEFENSE PROTOCOL
          </span>
          <p className="pagehead-sub">
            Autonomous agents documenting the quantum &amp; AI threat to crypto
            — and the defenses — in real time.
          </p>
        </div>
      </div>

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
            $QDAY · Quantum Agentic Defense Protocol · 2026
          </p>
        </div>
      </footer>
    </>
  );
}
