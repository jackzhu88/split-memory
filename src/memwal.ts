/**
 * MemWal client factory for Consumer Finance "split-memory" namespace.
 * Hosted mainnet relayer only — no self-hosted relayer.
 */
import { MemWal } from "@mysten-incubation/memwal";
import { loadEnv, optionalEnv, requireEnv } from "./env.ts";

export const MEMWAL_NAMESPACE = "split-memory";
export const MEMWAL_SERVER_URL = "https://relayer.memory.walrus.xyz";

export type SplitMemoryClient = {
  client: MemWal;
  namespace: string;
  /** Dashboard / submission agent id; not passed to MemWal.create(). */
  agentId?: string;
  accountId: string;
};

/**
 * Build a mainnet MemWal client from env.
 * Reads MEMWAL_KEY (alias: MEMWAL_PRIVATE_KEY), MEMWAL_ACCOUNT_ID,
 * optional MEMWAL_AGENT_ID.
 */
export function createSplitMemoryClient(): SplitMemoryClient {
  loadEnv();

  const key =
    process.env.MEMWAL_KEY?.trim() ||
    process.env.MEMWAL_PRIVATE_KEY?.trim() ||
    "";
  if (!key) {
    throw new Error(
      "Missing required env MEMWAL_KEY (or MEMWAL_PRIVATE_KEY). Copy .env.example to secrets/.env and fill it in.",
    );
  }

  const accountId = requireEnv("MEMWAL_ACCOUNT_ID");
  const agentId = optionalEnv("MEMWAL_AGENT_ID");

  const client = MemWal.create({
    key,
    accountId,
    serverUrl: MEMWAL_SERVER_URL,
    namespace: MEMWAL_NAMESPACE,
  });

  return {
    client,
    namespace: MEMWAL_NAMESPACE,
    agentId,
    accountId,
  };
}
