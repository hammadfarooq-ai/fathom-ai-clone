import { z } from "zod";
import { query, route } from "@/server/http";
import { searchWorkspace } from "@/server/text-search";

/** GET /api/search?q= — Postgres full-text search across meetings and transcripts. */
export const GET = route(async (req) => {
  const { q } = query(req, z.object({ q: z.string().trim().max(200).default("") }));
  return searchWorkspace(q);
});
