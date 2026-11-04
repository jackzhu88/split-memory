import { errorJson, handleRememberJob } from "../../src/handlers.ts";
import { loadEnv } from "../../src/env.ts";
loadEnv();
export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "GET") return errorJson("Method not allowed", 405);
    return handleRememberJob(req);
  },
};
