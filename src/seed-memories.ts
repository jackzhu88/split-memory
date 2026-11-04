/**
 * Seed ≥12 Consumer Finance split-bill memories on mainnet via hosted MemWal.
 * Does not invent fake success — each remember waits for the job, failures are reported.
 */
import { createSplitMemoryClient } from "./memwal.ts";

/** English, judge-friendly split-bill / shared-budget facts. */
export const SPLIT_MEMORIES: string[] = [
  "Split group 'Weekend Cabin': Alex owes Sam 42.50 USD for groceries from 2026-10-18.",
  "Split group 'Weekend Cabin': default split is equal shares among 4 people unless overridden.",
  "User preference: prefer Venmo-style settle later over instant on-chain transfer for amounts under 25 USD.",
  "Subscription limit learned: Netflix household share capped at 6 USD per person per month.",
  "Shared budget 'Groceries': monthly soft limit 320 USD; warn when remaining under 40 USD.",
  "Jordan paid the dinner tab of 86 USD on 2026-10-22; Riley still owes 43 USD (50/50 split).",
  "Roommate rule: utilities (electric + internet) split 60/40 with Morgan taking the larger share.",
  "Reject reason remembered: declined auto-renew for 'Gym Duo Pass' because combined spend exceeded 40 USD/month.",
  "Preferred currency for split summaries is USD; show crypto only as optional settlement rail.",
  "Travel pot 'Tokyo Trip': target savings 1200 USD by 2026-12-01; contribute weekly 75 USD each.",
  "Casey always covers Uber/Lyft first and logs reimbursements later; do not auto-ping within 24 hours.",
  "Learned habit: Friday takeout for the flat averages 28 USD and is split three ways.",
  "Shared card 'House Supplies': Quinn is category owner; purchases over 50 USD need a second confirm.",
  "IOU memory: Taylor lent Avery 15 USD for coffee beans on 2026-10-29; mark settled when Avery confirms.",
];

async function main(): Promise<void> {
  let mem;
  try {
    mem = createSplitMemoryClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[seed] credential check failed: ${message}`);
    process.exit(1);
  }

  console.log(
    `[seed] writing ${SPLIT_MEMORIES.length} memories to namespace=${mem.namespace}`,
  );

  let ok = 0;
  let failed = 0;
  const failures: { index: number; error: string }[] = [];

  for (let i = 0; i < SPLIT_MEMORIES.length; i++) {
    const text = SPLIT_MEMORIES[i]!;
    const label = `#${i + 1}/${SPLIT_MEMORIES.length}`;
    try {
      const accepted = await mem.client.remember(text, {
        idempotencyKey: `split-memory-seed-${i + 1}`,
        dedupe: true,
      });
      console.log(`[seed] ${label} job_id=${accepted.job_id} status=${accepted.status}`);
      const done = await mem.client.waitForRememberJob(accepted.job_id, {
        timeoutMs: 120_000,
      });
      console.log(
        `[seed] ${label} done blob_id=${done.blob_id} id=${done.id}`,
      );
      ok += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ index: i + 1, error: message });
      console.error(`[seed] ${label} FAILED: ${message}`);
    }
  }

  mem.client.destroy();

  console.log(`[seed] summary: success=${ok} failed=${failed} total=${SPLIT_MEMORIES.length}`);
  if (failures.length) {
    console.error("[seed] failures:");
    for (const f of failures) {
      console.error(`  #${f.index}: ${f.error}`);
    }
  }

  if (ok < 10) {
    console.error(
      `[seed] need at least 10 successful mainnet memories; got ${ok}. Not inventing fake data.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
