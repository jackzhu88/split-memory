/**
 * Bun.serve entry for Split Memory demo.
 * Local: `bun run demo` → http://127.0.0.1:8787/
 * Vercel: detected as Bun framework entry (`src/server.ts`) with bunVersion in vercel.json.
 *
 * Secrets stay server-side. Remember submits only; the browser polls /api/remember/job.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "./env.ts";
import { MEMWAL_NAMESPACE } from "./memwal.ts";
import { errorJson, routeApi } from "./handlers.ts";

const ROOT = resolve(import.meta.dir, "..");
const PUBLIC = resolve(ROOT, "public");
const PORT = Number(process.env.PORT || 8787);
// Hosted platforms (Vercel / containers) need 0.0.0.0; local default stays loopback.
const HOST =
  process.env.HOST ||
  (process.env.VERCEL || process.env.NOW_REGION ? "0.0.0.0" : "127.0.0.1");

loadEnv();

function contentTypeFor(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
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

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const api = await routeApi(req, pathname);
    if (api) return api;
    return serveStatic(pathname);
  },
});

console.log(
  `[demo] Split Memory UI → http://${server.hostname}:${server.port}/  (namespace=${MEMWAL_NAMESPACE})`,
);
console.log("[demo] Secrets stay in env / secrets/.env — never sent to the browser.");
console.log("[demo] Remember is async: POST /api/remember → poll GET /api/remember/job?id=");
