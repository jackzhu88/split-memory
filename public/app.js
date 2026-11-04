const $ = (id) => document.getElementById(id);

const statusBar = $("statusBar");
const rememberText = $("rememberText");
const rememberOut = $("rememberOut");
const recallQuery = $("recallQuery");
const recallOut = $("recallOut");
const tatumOut = $("tatumOut");
const exampleButtons = $("exampleButtons");

const SAMPLE =
  "Split group 'Demo Night': Pat owes Quinn 18.75 USD for pizza on 2026-11-04. Prefer settle-later under 25 USD.";

const POLL_MS = 1500;
const POLL_MAX_MS = 120_000;

async function getJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.payload = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

function setBusy(btn, busy, label) {
  btn.disabled = busy;
  if (label) btn.dataset.label ??= btn.textContent;
  btn.textContent = busy ? "Working…" : btn.dataset.label || label || btn.textContent;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function refreshHealth() {
  try {
    const data = await getJson("/api/health");
    statusBar.className = "meta ok";
    statusBar.textContent =
      `Relayer OK · namespace ${data.namespace} · account ${data.accountId_set ? "ready" : "missing"} · agent ${data.agentId_set ? "set" : "unset"} · Tatum ${data.tatum_key_set ? "ready" : "missing"}`;
  } catch (err) {
    statusBar.className = "meta bad";
    statusBar.textContent = `Relayer check failed: ${err.message}`;
  }
}

async function loadExamples() {
  try {
    const data = await getJson("/api/examples");
    exampleButtons.innerHTML = "";
    for (const q of data.queries || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ghost chip";
      b.textContent = q.length > 42 ? q.slice(0, 41) + "…" : q;
      b.title = q;
      b.addEventListener("click", () => {
        recallQuery.value = q;
        doRecall();
      });
      exampleButtons.appendChild(b);
    }
  } catch {
    /* optional */
  }
}

$("fillSampleBtn").addEventListener("click", () => {
  rememberText.value = SAMPLE;
});

async function pollRememberJob(jobId, textPreview) {
  const started = Date.now();
  while (Date.now() - started < POLL_MAX_MS) {
    const data = await getJson(
      `/api/remember/job?id=${encodeURIComponent(jobId)}`,
    );
    rememberOut.textContent = JSON.stringify(
      {
        ok: true,
        job_id: data.job_id,
        status: data.status,
        blob_id: data.blob_id,
        id: data.id,
        namespace: data.namespace,
        text_preview: textPreview,
        elapsed_ms: Date.now() - started,
      },
      null,
      2,
    );
    if (data.done || data.status === "done") {
      return data;
    }
    await sleep(POLL_MS);
  }
  const err = new Error(`remember job timed out after ${POLL_MAX_MS}ms (job still pending on relayer)`);
  err.payload = { job_id: jobId };
  throw err;
}

$("rememberBtn").addEventListener("click", async () => {
  const btn = $("rememberBtn");
  const text = rememberText.value.trim();
  if (!text) {
    rememberOut.textContent = "Enter a split-bill fact first.";
    return;
  }
  setBusy(btn, true);
  rememberOut.textContent = "Submitting remember job to mainnet…";
  try {
    const accepted = await getJson("/api/remember", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    rememberOut.textContent = JSON.stringify(
      {
        ok: true,
        phase: "accepted",
        job_id: accepted.job_id,
        status: accepted.status,
        namespace: accepted.namespace,
        text_preview: accepted.text_preview,
        poll: accepted.poll,
      },
      null,
      2,
    );
    await pollRememberJob(accepted.job_id, accepted.text_preview);
  } catch (err) {
    const extra = err.payload?.needs_gas_or_payment
      ? "\n\nSTOP: hosted write appears to need gas/payment. Do not top up without approval."
      : "";
    rememberOut.textContent = `Error: ${err.message}${extra}`;
  } finally {
    setBusy(btn, false);
  }
});

async function doRecall() {
  const btn = $("recallBtn");
  const query = recallQuery.value.trim();
  if (!query) {
    recallOut.innerHTML = `<p class="muted">Enter a query first.</p>`;
    return;
  }
  setBusy(btn, true);
  recallOut.innerHTML = `<p class="muted">Recalling…</p>`;
  try {
    const data = await getJson("/api/recall", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!data.hits?.length) {
      recallOut.innerHTML = `<p class="muted">No hits (total=${data.total ?? 0}). Seed memories or remember first.</p>`;
      return;
    }
    recallOut.innerHTML = data.hits
      .map(
        (h) => `<div class="hit">
          <div class="top"><span>distance ${Number(h.distance).toFixed(4)}</span><span>blob ${String(h.blob_id).slice(0, 14)}…</span></div>
          <div class="text"></div>
        </div>`,
      )
      .join("");
    [...recallOut.querySelectorAll(".hit .text")].forEach((el, i) => {
      el.textContent = data.hits[i].text;
    });
  } catch (err) {
    recallOut.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  } finally {
    setBusy(btn, false);
  }
}

$("recallBtn").addEventListener("click", doRecall);
recallQuery.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doRecall();
});

$("tatumBtn").addEventListener("click", async () => {
  const btn = $("tatumBtn");
  setBusy(btn, true);
  tatumOut.textContent = "Fetching Tatum GraphQL…";
  try {
    const data = await getJson("/api/tatum");
    const slim = {
      source: data.source,
      gateway: data.gateway,
      checkpoint: data.checkpoint,
      address: data.address
        ? {
            address: data.address.address,
            suiBalanceMist: data.address.suiBalanceMist,
          }
        : undefined,
    };
    tatumOut.textContent = JSON.stringify(slim, null, 2);
  } catch (err) {
    tatumOut.textContent = `Error: ${err.message}`;
  } finally {
    setBusy(btn, false);
  }
});

refreshHealth();
loadExamples();
