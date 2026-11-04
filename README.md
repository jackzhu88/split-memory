# Split Memory (Total Recall)

> Consumer Finance app that **remembers who owes whom**, shared budgets, and learned spend limits — powered by **Walrus Memory (MemWal)** on Sui mainnet, with **Tatum used only for readonly** Sui GraphQL.

**Track:** Consumer Finance · **Author:** [jackzhu88](https://github.com/jackzhu88) · **Telegram:** [@jackzhu8888](https://t.me/jackzhu8888)

Hosted relayer only. No prediction track, no AI Builder shell, no self-hosted relayer, no Move contracts, no x402.

## Why it exists

Group spending fails on forgotten context: IOUs, soft caps, settle-later preferences. Split Memory stores those facts as mainnet memories and recalls them in natural language so the next session starts smarter. The chain stays invisible in the product UI.

Typical facts:

- “Alex owes Sam 42.50 USD for groceries.”
- “Netflix household share is capped at 6 USD per person.”
- “Prefer settle-later under 25 USD.”
- “Utilities split 60/40 with Morgan taking the larger share.”

## How Tatum + Walrus Memory fit together

### Walrus Memory (MemWal) — write & recall

We use the hosted MemWal relayer (`https://relayer.memory.walrus.xyz`) with `@mysten-incubation/memwal`.

- **`POST /api/remember`** accepts a split-bill fact and returns a `job_id` immediately (no long server wait).
- **`GET /api/remember/job?id=`** is a one-shot status check (`pending` → `running` → `uploaded` → `done`). The demo UI polls until `blob_id` is ready.
- **`POST /api/recall`** runs semantic search over stored memories and returns ranked hits with distances.

Hosted relayer sponsorship has let us write mainnet memories without holding a funded hot wallet for every demo write. Secrets (delegate key, account id) stay on the server — never in the browser bundle, never in this public repo.

### Tatum — readonly Sui data

Tatum is used **read-only**. Split Memory does not send transactions through Tatum.

Demo calls Tatum’s Sui **GraphQL** gateway:

- `POST https://sui-mainnet.gateway.tatum.io/graphql`
- Auth: `x-api-key`
- Examples: latest checkpoint and optional SUI balance for the project address

That gives a live chain heartbeat next to the memory loop, without inventing numbers.

## How it learned over time

Memory is not a static dump. The product story is a **learning loop**:

1. **Seed history** — a batch of household facts (IOUs, budgets, caps, settle preferences) so recall has something to stand on.
2. **Live remember** — during a demo, a new fact is written; the UI shows `job_id` + `blob_id` as proof it landed on mainnet.
3. **Recall that changes the answer** — asking “Who owes whom for dinner?” surfaces older dinner IOUs and the new debt. Asking about spend limits surfaces soft caps learned earlier — not hard-coded UI copy.
4. **Preferences compound** — settle-later rules and category owners accumulate as more sessions write memories.

Over time the assistant’s answers shift because the memory set shifted — shown as real blob-backed hits rather than a scripted mock.

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | **Bun** 1.4+ (MemWal needs modern Bun) |
| Memory SDK | `@mysten-incubation/memwal` |
| Relayer | `https://relayer.memory.walrus.xyz` (hosted, mainnet) |
| Namespace | `split-memory` |
| Chain read | Tatum Sui **GraphQL** (readonly) |
| Demo UI | Bun HTTP server + static page (`bun run demo`) |
| Hosting target | Vercel Bun runtime (`vercel.json` → `bunVersion: "1.x"`, entry `src/server.ts`) |

## Quick start

```bash
bun install
cp .env.example secrets/.env
# edit secrets/.env — never commit it

bun run health   # MemWal relayer health
bun run seed     # write ≥12 split-bill memories; wait for each job
bun run recall   # sample semantic queries
bun run tatum    # live Tatum GraphQL checkpoint (+ optional balance)
bun run demo     # open http://127.0.0.1:8787/ — remember + recall UI
```

### Demo UI flow

1. Open the local page (secrets stay on the server; the browser never receives keys).
2. **Remember** a split fact → server accepts a `job_id`; the page polls `/api/remember/job` until `blob_id`.
3. **Recall** with a natural-language query (or click an example chip) → ranked hits.
4. Optional: **Tatum readonly** → latest checkpoint / SUI balance mist.

If a remember call demands gas or payment, the server returns a clear stop signal — do not top up without explicit approval.

## Credentials (server env only)

| Variable | Required | Purpose |
| --- | --- | --- |
| `MEMWAL_KEY` | yes | Ed25519 delegate private key from Walrus Memory |
| `MEMWAL_ACCOUNT_ID` | yes | Walrus Memory account object id |
| `TATUM_API_KEY` | yes | Tatum free-plan API key (readonly calls) |
| `MEMWAL_AGENT_ID` | optional | Dashboard / submission agent id (not passed to `MemWal.create`) |
| `SUI_ADDRESS` | optional | Address for identity / balance hint |
| `PORT` | optional | HTTP port (default `8787`; platforms set this) |
| `HOST` | optional | Bind address (local default `127.0.0.1`; set `0.0.0.0` on containers) |

Put values in `secrets/.env` (preferred) or `.env`. Both are gitignored. On a host like Vercel, set the same names as **project environment variables** — never bake them into the frontend. See `secrets/README.md`.

## Architecture

```
Browser UI ──► Bun server (src/server.ts)
                 ├─ POST /api/remember          → accept job_id only
                 ├─ GET  /api/remember/job?id=  → one-shot status (UI polls)
                 ├─ POST /api/recall
                 ├─ GET  /api/health|examples|tatum
                 └─ static public/
              ──► MemWal hosted relayer (remember / recall)
              ──► Tatum Sui GraphQL (readonly)
```

Shared handlers live in `src/handlers.ts`. Thin `api/*` adapters are also present for a static+functions layout; the primary path is the Bun.serve entry.

CLI scripts under `src/` share `createSplitMemoryClient` and the env loader.

### Local onboarding script

`src/onboard-sponsored.ts` is a **local-only** helper that walks the relayer’s sponsored `create_account` / `add_delegate_key` flow and **writes** `secrets/.env` + `secrets/sui-wallet.json`. Do not run it in CI or on a public host. Wallet material must never be committed.

## Docs

- [`docs/blog-draft.md`](docs/blog-draft.md) — project write-up (also summarized above)
- [`docs/demo-script.md`](docs/demo-script.md) — 2–3 minute demo script outline
- [`evidence/`](evidence/) — run receipts (job/blob ids and public digests only; no secrets)

## Deploy notes (Vercel, free tier)

Code is ready; secrets must be configured on the host after login:

1. Import this repo on Vercel (Hobby / free).
2. Set env: `MEMWAL_KEY`, `MEMWAL_ACCOUNT_ID`, `TATUM_API_KEY` (plus optional `MEMWAL_AGENT_ID`, `SUI_ADDRESS`).
3. Confirm `vercel.json` has `"bunVersion": "1.x"` and entry `src/server.ts` is detected.
4. If the platform asks for a credit card or paid plan, **stop** — do not upgrade without approval.

## Scope cuts

Out of scope for this MVP: Markets & Sports Prediction track, Tatum AI Builder as the product shell, self-hosted relayer, Seal/manual encryption deep dive, Move anchors, agent payments / x402, funded custody, dual-track submission.

## License / identity

Public builder identity is **jackzhu88** only. Contact: Telegram **@jackzhu8888**.
No other personal contact channels are published with this project.
