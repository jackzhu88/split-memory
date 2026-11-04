# Split Memory: a Consumer Finance app that remembers who owes whom

**Author:** jackzhu88  
**Contact:** Telegram @jackzhu8888  
**Track:** Consumer Finance (Tatum × Walrus Total Recall)  
**Status:** repo documentation — mirrored in the public README (not published on a separate blog or social channel)

---

## What it does

**Split Memory** is a small Consumer Finance product for shared spending: group dinners, roommate utilities, travel pots, and subscription caps. People already know how to split a bill. What they forget is the *context* — who covered last time, which soft limits were agreed, and why a renewal was declined.

Split Memory stores those facts as durable **Walrus Memory** entries on Sui mainnet (namespace `split-memory`). Later, anyone in the flow can ask a natural-language question and get the relevant history back. The chain stays invisible in the product UI; memory is what makes balances and habits stick.

Typical facts:

- “Alex owes Sam 42.50 USD for groceries.”
- “Netflix household share is capped at 6 USD per person.”
- “Prefer settle-later under 25 USD.”
- “Utilities split 60/40 with Morgan taking the larger share.”

## How Tatum + Walrus Memory fit together

### Walrus Memory (MemWal) — write & recall

We use the hosted MemWal relayer (`https://relayer.memory.walrus.xyz`) with the official SDK `@mysten-incubation/memwal`.

- **`remember(text)`** accepts a split-bill fact and returns a `job_id` immediately.
- The demo UI (and any host with short function timeouts) polls **`getRememberStatus(job_id)`** until a `blob_id` is available on mainnet — no single request waits minutes on the server.
- **`recall({ query, limit, namespace })`** runs semantic search over the stored memories and returns ranked hits with distances.

Hosted relayer sponsorship has let us write mainnet memories without holding a funded hot wallet for every demo write. Secrets (delegate key, account id) stay on the server — never in the browser bundle, never in the public repo.

### Tatum — readonly Sui data “where relevant”

Tatum is used **read-only**. Split Memory does not send transactions through Tatum.

For the demo we call Tatum’s Sui **GraphQL** gateway:

- `POST https://sui-mainnet.gateway.tatum.io/graphql`
- Auth: `x-api-key`
- Examples: latest checkpoint (`sequenceNumber`, `digest`, `timestamp`) and optional SUI balance for the project address.

That gives a live chain heartbeat next to the memory loop, without inventing numbers. Older JSON-RPC paths on the same host returned 404 in our checks; GraphQL is the path we actually wire.

## How it learned over time

Memory is not a static dump. The product story is a **learning loop**:

1. **Seed history** — We wrote a batch of household facts (IOUs, budgets, caps, settle preferences) so recall has something to stand on from day one.
2. **Live remember** — During a demo, a new fact is written (“Pat owes Quinn 18.75 USD for pizza”). The UI shows `job_id` + `blob_id` as proof it landed on mainnet.
3. **Recall that changes the answer** — Asking “Who owes whom for dinner?” surfaces both older dinner IOUs and the new pizza debt. Asking about spend limits surfaces Netflix / grocery soft caps that were learned earlier — not hard-coded UI copy.
4. **Preferences compound** — Settle-later rules, notification quiet hours, and category owners accumulate as more sessions write memories. The next session starts smarter without re-entering the same context.

Over time the assistant’s answers shift because the memory set shifted — that is the “learned over time” requirement, shown as real blob-backed hits rather than a scripted mock.

## Architecture (short)

```
Browser UI  →  Bun demo server  →  MemWal hosted relayer (remember / recall)
                               ↘  Tatum Sui GraphQL (readonly checkpoint / balance)
```

- Runtime: Bun (`src/server.ts`; Vercel `bunVersion: "1.x"`)
- Namespace: `split-memory`
- Secrets: local `secrets/.env` or host env vars only (gitignored / never in the frontend)
- Out of scope for this MVP: prediction track, AI Builder shell, self-hosted relayer, Move contracts, x402 payments

## Try it locally

```bash
bun install
cp .env.example secrets/.env   # fill MemWal + Tatum values
bun run demo                   # open http://127.0.0.1:8787/
```

Also available: `bun run health`, `bun run seed`, `bun run recall`, `bun run tatum`.

## Public identity

- GitHub / builder handle: **jackzhu88**
- Telegram: **@jackzhu8888**

No other personal contact channels are published with this project.
