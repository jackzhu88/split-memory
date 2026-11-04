/**
 * Connectivity check against the hosted MemWal relayer.
 * Exits non-zero with a clear message when credentials are missing.
 */
import { createSplitMemoryClient } from "./memwal.ts";

async function main(): Promise<void> {
  let mem;
  try {
    mem = createSplitMemoryClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[health] credential check failed: ${message}`);
    process.exit(1);
  }

  console.log(`[health] namespace=${mem.namespace}`);
  console.log(`[health] accountId set=${Boolean(mem.accountId)}`);
  console.log(`[health] agentId set=${Boolean(mem.agentId)}`);
  console.log(`[health] calling relayer health()…`);

  const result = await mem.client.health();
  console.log("[health] ok", result);
  mem.client.destroy();
}

main().catch((err) => {
  console.error("[health] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
