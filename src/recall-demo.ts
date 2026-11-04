/**
 * Demo recalls for split-bill memory. Prints short summaries only — never dumps keys.
 */
import { createSplitMemoryClient } from "./memwal.ts";

const QUERIES = [
  "Who owes whom money in the weekend cabin or dinner splits?",
  "What subscription or spend limits has the household learned?",
  "What are the shared budget preferences and contribution rules?",
  "Any settle-later preferences or notification rules for IOUs?",
];

function summarizeHit(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

async function main(): Promise<void> {
  let mem;
  try {
    mem = createSplitMemoryClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[recall] credential check failed: ${message}`);
    process.exit(1);
  }

  console.log(`[recall] namespace=${mem.namespace}`);

  for (const query of QUERIES) {
    console.log("\n---");
    console.log(`[recall] query: ${query}`);
    try {
      const result = await mem.client.recall({
        query,
        limit: 5,
        namespace: mem.namespace,
      });
      console.log(
        `[recall] hits=${result.results.length} total=${result.total}` +
          (result.dropped_count ? ` dropped=${result.dropped_count}` : ""),
      );
      for (const hit of result.results) {
        console.log(
          `  distance=${hit.distance.toFixed(4)} blob=${hit.blob_id.slice(0, 12)}… | ${summarizeHit(hit.text)}`,
        );
      }
      if (result.results.length === 0) {
        console.log("  (no matches — seed memories first with bun run seed)");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[recall] query failed: ${message}`);
    }
  }

  mem.client.destroy();
  console.log("\n[recall] done");
}

main().catch((err) => {
  console.error("[recall] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
