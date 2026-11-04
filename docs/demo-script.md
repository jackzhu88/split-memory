# Split Memory — 2–3 minute demo script

**Target length:** 2:00–3:00  
**Product:** Split Memory (Consumer Finance · Total Recall)  
**Public identity on screen / VO:** jackzhu88 · Telegram @jackzhu8888  
**Do not say on camera:** location names, personal chat apps or private email, box paths, private keys

---

## Shot list + VO

| # | Time | On screen | Voice-over / talk track |
|---|------|-----------|-------------------------|
| 1 | 0:00–0:25 | Title card or hero of local demo UI (`Split Memory`). Brief zoom on badge “Consumer Finance · Walrus Memory + Tatum”. | “Hi, I’m jackzhu88. Split Memory is a Consumer Finance app that remembers who owes whom, shared budgets, and spend limits — so group spending feels normal while blockchain stays invisible.” |
| 2 | 0:25–0:45 | Status bar showing relayer OK / namespace `split-memory`. Optional one-line README or architecture diagram. | “It runs on Walrus Memory mainnet through the hosted relayer, namespace split-memory. Tatum is used only for readonly Sui GraphQL — checkpoints and balances, no writes.” |
| 3 | 0:45–1:25 | **Remember** panel: paste/type a new fact, e.g. `Split group 'Demo Night': Pat owes Quinn 18.75 USD for pizza on 2026-11-04.` Click **Remember on mainnet**. Wait for JSON with `job_id` + `blob_id`. Highlight those fields. | “Here’s a new IOU. I write it with remember. The hosted relayer accepts a job, then we wait until the blob is on mainnet. You can see the job id and blob id — real storage, not a mock.” |
| 4 | 1:25–2:10 | **Recall** panel: run example chip *Who owes whom…* or type the same question. Scroll hits; point at distance + blob prefix + the new pizza line among older cabin/dinner debts. Optional second query on spend limits. | “Now semantic recall: who owes whom? We get ranked memories — older cabin and dinner splits plus the pizza debt we just wrote. A second query on subscription limits surfaces caps the household learned over time.” |
| 5 | 2:10–2:30 | Click **Fetch checkpoint / balance**. Show checkpoint sequence + digest (and zero balance if shown). | “Tatum readonly: live Sui checkpoint through their GraphQL gateway. Confirms we’re talking to mainnet data without inventing numbers.” |
| 6 | 2:30–2:50 | Repo README headline or docs folder briefly; end on UI footer with jackzhu88 / @jackzhu8888. | “Code and docs are in the public repo. Built by jackzhu88 — Telegram @jackzhu8888. Thanks for watching.” |
| Buffer | ±10s | If remember is slow, narrate waiting on the job instead of cutting away. If recall is empty, fall back to a seeded query chip before ending. | Keep total under 3:00. |

---

## Recording notes (for later — not in this task)

- Prefer the local Bun demo (`bun run demo`) with ordinary Chrome; no wallet import.
- Mask any accidental secret panes; never open `secrets/`.
- Capture remember + recall in one continuous take if possible.
- Export 1080p mp4 when video is approved; this file is script-only.

## Checklist before press record

- [ ] `bun run health` OK
- [ ] Demo page loads; status bar green
- [ ] Sample remember text ready
- [ ] At least one seeded recall chip returns hits
- [ ] Tatum button returns a real checkpoint
