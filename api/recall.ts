import { errorJson, handleRecall } from "../src/handlers.ts";
import { loadEnv } from "../src/env.ts";
loadEnv();
export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") return errorJson("Method not allowed", 405);
    return handleRecall(req);
  },
};
