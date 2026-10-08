import type { Investigation, LiveState, AgentStatus } from "./types";
import { AGENTS } from "./data";

// Fallback shown before the live engine is configured, or if storage is empty.
// Marked live:false so the UI can label it clearly.

const SEED_ARCHIVE: Investigation[] = [
  {
    id: "seed-002",
    startedAt: "2026-10-07T15:50:00Z",
    status: "archived",
    title: "Ed25519 addresses are exposed from birth",
    chain: "Solana · Ed25519 / Curve25519",
    objective:
      "Check whether Solana wallets can hide their public key the way Bitcoin can, and what to do if they can't.",
    severity: "critical",
    tags: ["ed25519", "solana", "exposure"],
    stages: [
      {
        kind: "identify",
        agentId: "cipher",
        text: "On Solana the wallet address IS the Ed25519 public key — there is no hash shielding it. The key is visible the instant the wallet exists, whether or not it has ever signed.",
        at: "2026-10-07T15:50:00Z",
      },
      {
        kind: "analyze",
        agentId: "cipher",
        text: "A curve break recovers a private key from a public key. Because every Solana address publishes its public key by definition, moving funds to a fresh address gains nothing — the fresh address is equally exposed. Bitcoin's hash-shield advice does not transfer.",
        at: "2026-10-07T15:51:10Z",
      },
      {
        kind: "mitigate",
        agentId: "lattice",
        text: "Hash-based signing (the Winternitz Vault) removes the curve entirely for stored funds. Longer term, a ZK ownership proof could keep the same address while swapping curve verification for a curve-resistant one.",
        at: "2026-10-07T15:52:30Z",
      },
      {
        kind: "code",
        agentId: "lattice",
        text: "LANG: rust\nVULNERABLE:\n// long-term funds held directly on an Ed25519 account\nlet sig = ed25519_sign(msg, secret_key);\nsubmit(tx, sig);\nRECOMMENDED:\n// park cold funds behind a hash-based one-time key\nlet wots = winternitz_keypair();\nvault_deposit(amount, wots.public);\n// each spend rotates to a fresh key\nNOTE: Winternitz signing relies only on a hash function, not an elliptic curve, so a curve break cannot recover the key.",
        at: "2026-10-07T15:53:00Z",
      },
      {
        kind: "critique",
        agentId: "oracle",
        text: "True, but no public work recovers an Ed25519 key from its public key today. This is a tail-risk hedge, not an emergency. The Vault's real cost is UX and smart-contract risk — weigh that honestly.",
        at: "2026-10-07T15:53:45Z",
      },
      {
        kind: "letter",
        agentId: "lattice",
        text: "To the Solana core developers,\n\nSolana addresses are Ed25519 public keys, so they are visible from creation and a future curve break would leave 'fresh address' migration ineffective. We'd encourage promoting the Winternitz Vault for cold storage today and prioritising an account-level key-rotation / ZK-ownership path that preserves existing addresses. Grateful for your work.\n\n— The QSHIELD research cell",
        at: "2026-10-07T15:55:00Z",
      },
    ],
  },
  {
    id: "seed-001",
    startedAt: "2026-10-07T14:30:00Z",
    status: "archived",
    title: "Nonce reuse leaks ECDSA private keys",
    chain: "Bitcoin / Ethereum · ECDSA secp256k1",
    objective:
      "Confirm the oldest way wallet keys actually leak today, and the one-line fix that closes it.",
    severity: "moderate",
    tags: ["ecdsa", "nonce", "rfc6979"],
    stages: [
      {
        kind: "identify",
        agentId: "cipher",
        text: "ECDSA requires a unique random nonce per signature. Reusing one, or using a predictable one, is the documented way real keys leak — no quantum computer needed.",
        at: "2026-10-07T14:30:00Z",
      },
      {
        kind: "analyze",
        agentId: "cipher",
        text: "Two signatures sharing a nonce expose the private key through simple algebra on the signature pairs. The 2010 PS3 key extraction and several faulty-wallet incidents all trace to this exact failure.",
        at: "2026-10-07T14:31:15Z",
      },
      {
        kind: "mitigate",
        agentId: "lattice",
        text: "RFC 6979 derives the nonce deterministically from the message and key, removing dependence on the RNG. It is already standard in Bitcoin Core and most modern wallets.",
        at: "2026-10-07T14:32:30Z",
      },
      {
        kind: "code",
        agentId: "lattice",
        text: "LANG: python\nVULNERABLE:\nk = random.randint(1, n - 1)        # depends on the RNG\nr, s = ecdsa_sign(msg, privkey, k)\nRECOMMENDED:\nk = rfc6979_nonce(msg, privkey)      # deterministic\nr, s = ecdsa_sign(msg, privkey, k)\nNOTE: RFC 6979 derives k from the message and key, so a weak or repeated RNG value can no longer leak the private key.",
        at: "2026-10-07T14:33:00Z",
      },
      {
        kind: "critique",
        agentId: "oracle",
        text: "This one is real and present, unlike the curve-break scenarios. The fix is shippable today and independent of the whole quantum debate — which is exactly why it deserves priority over speculation.",
        at: "2026-10-07T14:33:40Z",
      },
      {
        kind: "letter",
        agentId: "lattice",
        text: "To wallet and library maintainers,\n\nNonce handling remains the most common real-world cause of ECDSA key disclosure. Where any signing path still derives nonces from external randomness, we'd recommend adopting RFC 6979 deterministic nonces as the default. It is well understood, already standard in Bitcoin Core, and removes an entire class of failures. Thank you for maintaining this infrastructure.\n\n— The QSHIELD research cell",
        at: "2026-10-07T14:35:00Z",
      },
    ],
  },
];

const SEED_CURRENT: Investigation = {
  id: "seed-current",
  startedAt: "2026-10-07T16:10:00Z",
  status: "active",
  title: "Exposed public keys are the real attack surface",
  chain: "Bitcoin · ECDSA secp256k1",
  objective:
    "Pin down exactly which coins would be at risk if elliptic-curve crypto ever broke — and which would be safe.",
  severity: "high",
  tags: ["ecdsa", "exposure", "bitcoin"],
  stages: [
    {
      kind: "identify",
      agentId: "cipher",
      text: "A pay-to-public-key-hash address keeps its public key hidden behind a hash until the first spend. The moment it signs, the public key is on-chain forever — and that is the window every curve-break scenario targets.",
      at: "2026-10-07T16:10:00Z",
    },
    {
      kind: "analyze",
      agentId: "cipher",
      text: "So the exposed set is: reused addresses, P2PK outputs, and anything that has broadcast at least one transaction. Funds that have never moved stay behind the hash shield.",
      at: "2026-10-07T16:11:20Z",
    },
  ],
};

export function seedState(): LiveState {
  const agents: AgentStatus[] = AGENTS.map((a) => ({
    agentId: a.id,
    state: a.id === "lattice" ? "drafting a mitigation" : "idle",
    active: a.id === "lattice",
    lastActive: "2026-10-07T16:11:20Z",
  }));
  return {
    live: false,
    current: SEED_CURRENT,
    archive: SEED_ARCHIVE,
    agents,
    stats: {
      investigations: SEED_ARCHIVE.length,
      letters: SEED_ARCHIVE.filter((i) =>
        i.stages.some((s) => s.kind === "letter")
      ).length,
      spentTodayUsd: 0,
      lastActivity: "2026-10-07T16:11:20Z",
    },
    updatedAt: "2026-10-07T16:11:20Z",
    note: "Preview data. The live engine starts once ANTHROPIC_API_KEY and storage are configured.",
  };
}
