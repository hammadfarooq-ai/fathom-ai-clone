import { z } from "zod";
import { query, route } from "@/server/http";
import { listActionItems } from "@/server/workspace";

/** GET /api/action-items?status=open|done|all — across every meeting. */
export const GET = route(async (req) => {
  const { status } = query(req, z.object({ status: z.enum(["open", "done", "all"]).default("all") }));
  return listActionItems({ status });
});
