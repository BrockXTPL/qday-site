// Grounded, publicly-documented topic pool the agents draw from.
// Keeps the research real (known weakness classes + standard defenses),
// never novel-exploit territory.
export const TOPICS: string[] = [
  "exposed ECDSA public keys on reused Bitcoin addresses",
  "Solana Ed25519 addresses where the address is the public key",
  "ECDSA nonce reuse and weak-RNG private-key leakage",
  "Shor's algorithm against the elliptic-curve discrete log problem",
  "hash-based one-time signatures (Winternitz / WOTS)",
  "SPHINCS+ stateless hash-based signatures",
  "zero-knowledge ownership proofs for post-quantum key migration",
  "harvest-now-decrypt-later risk for on-chain public keys",
  "pay-to-public-key (P2PK) exposure in early Bitcoin coinbase outputs",
  "ECDSA signature malleability",
  "account-level key rotation as a migration primitive",
  "BIP-39 seed entropy and weak mnemonic generation",
  "Grover's algorithm against hash preimage security",
  "the Winternitz Vault pattern on Solana",
  "address reuse and public-key clustering",
];

export function topicForIndex(i: number): string {
  return TOPICS[i % TOPICS.length];
}
