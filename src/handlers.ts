/**
 * Shared HTTP handlers for Split Memory demo API.
 * Used by the local Bun server and by Vercel Bun / api routes.
 * Secrets stay server-side (env / secrets/.env) — never in responses or the browser bundle.
 */
import { createSplitMemoryClient, MEMWAL_NAMESPACE, MEMWAL_SERVER_URL } from "./memwal.ts";
import { fetchPublicChainHint } from "./tatum-readonly.ts";
import { optionalEnv } from "./env.ts";

export const EXAMPLE_QUERIES = [
  "Who owes whom money in the weekend cabin or dinner splits?",
  "What subscription or spend limits has the household learned?",
  "What are the shared budget preferences and contribution rules?",
];

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function errorJson(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return json({ ok: false, error: message, ...extra }, status);
}

function needsGasOrPayment(message: string): boolean {
  return /gas|insufficient|balance|payment|fund|WAL|SUI.*fee|pay/i.test(message);
}

function gasExtra(message: string): Record<string, unknown> | undefined {
  if (!needsGasOrPayment(message)) return undefined;
  return {
    needs_gas_or_payment: true,
    stop_rule:
      "Hosted write appears to need gas/payment — stop; do not top up without approval.",
  };
}

/** POST /api/remember — submit only; does NOT wait for blob. */
export async function handleRemember(req: Request): Promise<Response> {
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
    return json({
      ok: true,
      namespace: mem.namespace,
      job_id: accepted.job_id,
      status: accepted.status,
      text_preview: text.length > 160 ? `${text.slice(0, 159)}…` : text,
      poll: `/api/remember/job?id=${encodeURIComponent(accepted.job_id)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const extra = gasExtra(message);
    return errorJson(message, extra ? 402 : 502, extra);
  } finally {
    mem.client.destroy();
  }
}

/** GET /api/remember/job?id= — one-shot status (client polls until done). */
export async function handleRememberJob(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const jobId = (url.searchParams.get("id") || url.searchParams.get("job_id") || "").trim();
  if (!jobId) return errorJson("id (job_id) query param is required");

  const mem = createSplitMemoryClient();
  try {
    const status = await mem.client.getRememberStatus(jobId);
    const terminalFailed = status.status === "failed" || status.status === "not_found";
    const done = status.status === "done";
    const payload: Record<string, unknown> = {
      ok: !terminalFailed,
      namespace: status.namespace ?? mem.namespace,
      job_id: status.job_id || jobId,
      status: status.status,
      blob_id: status.blob_id,
      id: done ? status.job_id || jobId : undefined,
      error: status.error,
      done,
    };
    if (terminalFailed) {
      const msg = status.error || `remember job ${status.status}`;
      const extra = gasExtra(msg);
      return errorJson(msg, extra ? 402 : 502, {
        ...extra,
        job_id: status.job_id || jobId,
        status: status.status,
        namespace: status.namespace ?? mem.namespace,
      });
    }
    return json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const extra = gasExtra(message);
    return errorJson(message, extra ? 402 : 502, extra);
  } finally {
    mem.client.destroy();
  }
}

/** POST /api/recall */
export async function handleRecall(req: Request): Promise<Response> {
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

/** GET /api/health */
export async function handleHealth(): Promise<Response> {
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

/** GET /api/examples */
export function handleExamples(): Response {
  return json({ ok: true, namespace: MEMWAL_NAMESPACE, queries: EXAMPLE_QUERIES });
}

/** GET /api/tatum */
export async function handleTatum(): Promise<Response> {
  try {
    const hint = await fetchPublicChainHint();
    return json({ ok: true, ...hint });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorJson(message, 502);
  }
}

/** Route API requests; returns null if path is not an API route. */
export async function routeApi(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === "/api/health" && req.method === "GET") return handleHealth();
  if (pathname === "/api/examples" && req.method === "GET") return handleExamples();
  if (pathname === "/api/remember" && req.method === "POST") return handleRemember(req);
  if (pathname === "/api/remember/job" && req.method === "GET") return handleRememberJob(req);
  if (pathname === "/api/recall" && req.method === "POST") return handleRecall(req);
  if (pathname === "/api/tatum" && req.method === "GET") return handleTatum();
  if (pathname.startsWith("/api/")) return errorJson("Not found", 404);
  return null;
}
