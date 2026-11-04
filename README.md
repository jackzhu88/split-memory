# Split Memory (Total Recall)

> Consumer Finance app that **remembers who owes whom**, shared budgets, and learned spend limits — powered by **Walrus Memory (MemWal)** on Sui mainnet, with **Tatum used only for readonly** Sui GraphQL.

**Track:** Consumer Finance · **Author:** [jackzhu88](https://github.com/jackzhu88) · **Telegram:** [@jackzhu8888](https://t.me/jackzhu8888)

Hosted relayer only. No prediction track, no AI Builder shell, no self-hosted relayer, no Move contracts, no x402.

## Why it exists

Group spending fails on forgotten context: IOUs, soft caps, settle-later preferences. Split Memory stores those facts as mainnet memories and recalls them in natural language so the next session starts smarter. The chain stays invisible in the product UI.

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | **Bun** 1.4+ (MemWal needs modern Bun / Node) |
| Memory SDK | `@mysten-incubation/memwal` |
| Relayer | `https://relayer.memory.walrus.xyz` (hosted, mainnet) |
| Namespace | `split-memory` |
| Chain read | Tatum Sui **GraphQL** `https://sui-mainnet.gateway.tatum.io/graphql` (readonly) |
| Demo UI | Local Bun HTTP server + static page (`bun run demo`) |

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
2. **Remember** a split fact → see `job_id` / `blob_id` from mainnet.
3. **Recall** with a natural-language query (or click an example chip) → ranked hits.
4. Optional: **Tatum readonly** → latest checkpoint / SUI balance mist.

If a remember call demands gas or payment, the server returns a clear stop signal — do not top up without explicit approval.

## Credentials

| Variable | Required | Purpose |
| --- | --- | --- |
| `MEMWAL_KEY` | yes | Ed25519 delegate private key from Walrus Memory |
| `MEMWAL_ACCOUNT_ID` | yes | Walrus Memory account object id |
| `TATUM_API_KEY` | yes | Tatum free-plan API key (readonly calls) |
| `MEMWAL_AGENT_ID` | optional | Dashboard / submission agent id (not passed to `MemWal.create`) |
| `SUI_ADDRESS` | optional | Address for identity / balance hint |

Put values in `secrets/.env` (preferred) or `.env`. Both are gitignored. See `secrets/README.md`.

## Architecture

```
Browser UI ──► Bun demo server ──► MemWal hosted relayer (remember / recall)
                              └──► Tatum Sui GraphQL (readonly)
```

CLI scripts under `src/` share the same client factory (`createSplitMemoryClient`) and env loader.

## Docs

- [`docs/blog-draft.md`](docs/blog-draft.md) — unpublished blog draft (what / how / learned over time)
- [`docs/demo-script.md`](docs/demo-script.md) — 2–3 minute demo script outline
- [`evidence/`](evidence/) — run receipts (job/blob ids only; no secrets)

## Scope cuts

Out of scope for this MVP: Markets & Sports Prediction track, Tatum AI Builder as the product shell, self-hosted relayer, Seal/manual encryption deep dive, Move anchors, agent payments / x402, funded custody, dual-track submission.

## License / identity

Public builder identity is **jackzhu88** only. Contact: Telegram **@jackzhu8888**.
