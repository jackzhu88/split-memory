import { handleHealth } from "../src/handlers.ts";
import { loadEnv } from "../src/env.ts";
loadEnv();
export default {
  async fetch(_req: Request): Promise<Response> {
    return handleHealth();
  },
};
