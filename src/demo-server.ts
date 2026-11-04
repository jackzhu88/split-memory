/**
 * Local demo HTTP server for Split Memory (Total Recall).
 * Secrets stay server-side (secrets/.env). Browser never receives keys.
 *
 * Endpoints:
 *   GET  /                 → demo UI
 *   GET  /api/health       → MemWal health + env presence (no secrets)
 *   POST /api/remember     → { text } → remember + waitForRememberJob
 *   POST /api/recall       → { query, limit? } → semantic recall
 *   GET  /api/tatum        → Tatum Sui GraphQL readonly hint
 *   GET  /api/examples     → canned recall example queries
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createSplitMemoryClient, MEMWAL_NAMESPACE, MEMWAL_SERVER_URL } from "./memwal.ts";
import { fetchPublicChainHint } from "./tatum-readonly.ts";
import { loadEnv, optionalEnv } from "./env.ts";

const ROOT = resolve(import.meta.dir, "..");
const PUBLIC = resolve(ROOT, "public");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";

const EXAMPLE_QUERIES = [
  "Who owes whom money in the weekend cabin or dinner splits?",
  "What subscription or spend limits has the household learned?",
  "What are the shared budget preferences and contribution rules?",
];

loadEnv();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function errorJson(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ ok: false, error: message, ...extra }, status);
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function serveStatic(pathname: string): Promise<Response> {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(PUBLIC, "." + rel);
  if (!filePath.startsWith(PUBLIC) || !existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }
  const file = Bun.file(filePath);
  return new Response(file, {
    headers: { "content-type": contentTypeFor(filePath) },
  });
}

async function handleRemember(req: Request): Promise<Response> {
  let body: { text?: string; idempotencyKey?: string };
  try {
    body = (await req.json()) as { text?: string; idempotencyKey?: string };
  } catch {
    return errorJson("Invalid JSON body");
  }
  const text = (body.text ?? "").trim();
  if (!text) return errorJson("text is required");
  if (text.length > 2000) return errorJson("text too long (max 2000 chars)");

  const mem = createSplitMemoryClient();
  try {
    const idempotencyKey =
      body.idempotencyKey?.trim() ||
      `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const accepted = await mem.client.remember(text, {
      idempotencyKey,
      dedupe: true,
    });
    const done = await mem.client.waitForRememberJob(accepted.job_id, {
      timeoutMs: 120_000,
    });
    return json({
      ok: true,
      namespace: mem.namespace,
      job_id: accepted.job_id,
      status: accepted.status,
      blob_id: done.blob_id,
      id: done.id,
      text_preview: text.length > 160 ? `${text.slice(0, 159)}…` : text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Stop clearly if the relayer asks for gas / payment.
    const needsGas =
      /gas|insufficient|balance|payment|fund|WAL|SUI.*fee|pay/i.test(message);
    return errorJson(message, needsGas ? 402 : 502, {
      needs_gas_or_payment: needsGas,
      stop_rule:
        needsGas
          ? "Hosted write appears to need gas/payment — stop; do not top up without approval."
          : undefined,
    });
  } finally {
    mem.client.destroy();
  }
}

async function handleRecall(req: Request): Promise<Response> {
  let body: { query?: string; limit?: number };
  try {
    body = (await req.json()) as { query?: string; limit?: number };
  } catch {
    return errorJson("Invalid JSON body");
  }
  const query = (body.query ?? "").trim();
  if (!query) return errorJson("query is required");
  const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 20);

  const mem = createSplitMemoryClient();
  try {
    const result = await mem.client.recall({
      query,
      limit,
      namespace: mem.namespace,
    });
    return json({
      ok: true,
      namespace: mem.namespace,
      query,
      total: result.total,
      dropped_count: result.dropped_count ?? 0,
      hits: result.results.map((hit) => ({
        distance: hit.distance,
        blob_id: hit.blob_id,
        text: hit.text,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorJson(message, 502);
  } finally {
    mem.client.destroy();
  }
}

async function handleHealth(): Promise<Response> {
  try {
    const mem = createSplitMemoryClient();
    try {
      const health = await mem.client.health();
      return json({
        ok: true,
        namespace: mem.namespace,
        relayer: MEMWAL_SERVER_URL,
        accountId_set: Boolean(mem.accountId),
        agentId_set: Boolean(mem.agentId),
        sui_address_set: Boolean(optionalEnv("SUI_ADDRESS")),
        tatum_key_set: Boolean(optionalEnv("TATUM_API_KEY")),
        health,
      });
    } finally {
      mem.client.destroy();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorJson(message, 503);
  }
}

async function handleTatum(): Promise<Response> {
  try {
    const hint = await fetchPublicChainHint();
    return json({ ok: true, ...hint });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorJson(message, 502);
  }
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (pathname === "/api/health" && req.method === "GET") {
      return handleHealth();
    }
    if (pathname === "/api/examples" && req.method === "GET") {
      return json({ ok: true, namespace: MEMWAL_NAMESPACE, queries: EXAMPLE_QUERIES });
    }
    if (pathname === "/api/remember" && req.method === "POST") {
      return handleRemember(req);
    }
    if (pathname === "/api/recall" && req.method === "POST") {
      return handleRecall(req);
    }
    if (pathname === "/api/tatum" && req.method === "GET") {
      return handleTatum();
    }
    if (pathname.startsWith("/api/")) {
      return errorJson("Not found", 404);
    }
    return serveStatic(pathname);
  },
});

console.log(
  `[demo] Split Memory UI → http://${server.hostname}:${server.port}/  (namespace=${MEMWAL_NAMESPACE})`,
);
console.log("[demo] Secrets stay in secrets/.env — never sent to the browser.");
