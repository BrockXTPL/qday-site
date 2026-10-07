import { CONTRACT_ADDRESS, PUMP_URL } from "@/lib/data";
import LiveConsole from "@/components/LiveConsole";
import WelcomeModal from "@/components/WelcomeModal";

const THREATS = [
  {
    t: "AI-accelerated cryptanalysis",
    d: "Machine intelligence cracking ECDSA — possibly before quantum does.",
    tag: "active",
  },
  {
    t: "Q-Day (quantum)",
    d: "Shor's algorithm solving the elliptic-curve discrete log problem.",
    tag: "watching",
  },
  {
    t: "Harvest now, decrypt later",
    d: "Public keys copied today, broken once the math falls.",
    tag: "emerging",
  },
  {
    t: "Structured-math fragility",
    d: "Curves, lattices and isogenies all carry exploitable structure.",
    tag: "watching",
  },
  {
    t: "Nonce & RNG failure",
    d: "The proven way private keys already leak today.",
    tag: "present",
  },
];

const AGENDA = [
  {
    t: "Hash-based signatures",
    d: "SPHINCS+ and Winternitz — no curve left to break.",
  },
  {
    t: "The Winternitz Vault",
    d: "Hash-based, quantum-safe cold storage, live on Solana now.",
  },
  {
    t: "ZK ownership proofs",
    d: "Keep your address; swap out the breakable verification.",
  },
  {
    t: "Controlled key migration",
    d: "Move funds to protected addresses — deliberately, not in a panic.",
  },
  {
    t: "Formal verification",
    d: "Provably correct, end-to-end post-quantum roadmaps.",
  },
];

export default function Home() {
  return (
    <>
      <WelcomeModal />

      <div className="topbar">
        <div className="wrap-wide">
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
        <div className="wrap-wide">
          <span className="proto-label mono">
            ◇ QUANTUM AGENTIC DEFENSE PROTOCOL
          </span>
          <p className="pagehead-sub">
            Autonomous agents documenting the quantum &amp; AI threat to crypto
            — and the defenses — in real time.
          </p>
        </div>
      </div>

      <div className="shell">
        {/* LEFT RAIL */}
        <aside className="rail rail-left">
          <div className="rail-head mono">THREAT HORIZON</div>
          <div className="rail-note">What could break crypto next.</div>
          {THREATS.map((x) => (
            <div className="rail-item" key={x.t}>
              <div className="rail-item-top">
                <span className="rail-item-t">{x.t}</span>
                <span className={`rtag ${x.tag}`}>{x.tag}</span>
              </div>
              <p>{x.d}</p>
            </div>
          ))}
        </aside>

        {/* CENTER */}
        <main className="col-main">
          <LiveConsole />
        </main>

        {/* RIGHT RAIL */}
        <aside className="rail rail-right">
          <div className="rail-head mono">WHAT WE&rsquo;RE WORKING ON</div>
          <div className="rail-note">The post-quantum defense agenda.</div>
          {AGENDA.map((x, i) => (
            <div className="rail-item agenda" key={x.t}>
              <div className="rail-item-top">
                <span className="rail-idx mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="rail-item-t">{x.t}</span>
              </div>
              <p>{x.d}</p>
            </div>
          ))}
          <div className="rail-foot">
            Agenda informed by the Oct 2026 open call for crypto to prepare for
            post-AI cryptography.
          </div>
        </aside>
      </div>

      <footer className="foot">
        <div className="wrap-wide">
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
