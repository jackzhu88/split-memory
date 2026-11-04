# Secrets (local only)

Put real credentials in `secrets/.env` (preferred) or a root `.env`.

Both paths are gitignored. Do **not** commit real keys, paste them into
README, screenshots, chat logs, or evidence files.

Also keep wallet files such as `sui-wallet.json` here only. They are gitignored.

## Required for MemWal (mainnet remember / recall)

| Variable | What it is |
| --- | --- |
| `MEMWAL_KEY` | Ed25519 delegate private key from the Walrus Memory dashboard |
| `MEMWAL_ACCOUNT_ID` | Walrus Memory account object ID |

Optional:

| Variable | What it is |
| --- | --- |
| `MEMWAL_AGENT_ID` | Agent id from the dashboard (needed for the hackathon form; SDK `create()` does not take it) |

Relayer is hardcoded to the hosted mainnet URL in code:
`https://relayer.memory.walrus.xyz`

## Required for Tatum readonly

| Variable | What it is |
| --- | --- |
| `TATUM_API_KEY` | API key from the Tatum dashboard (free tier) |

## Optional

| Variable | What it is |
| --- | --- |
| `SUI_ADDRESS` | Sui address for identity / readonly balance hint |

## Quick start

```bash
cp .env.example secrets/.env
# edit secrets/.env with real values
bun run health
bun run seed
bun run recall
bun run demo
```

Never share `secrets/.env` or wallet JSON outside this machine.
