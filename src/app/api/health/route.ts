import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { route } from "@/server/http";

/** Liveness + database connectivity check. */
export const GET = route(async () => {
  const started = Date.now();
  const [row] = await getDb().execute<{ meetings: number }>(sql`SELECT count(*)::int AS meetings FROM meetings`);
  return { ok: true, database: "postgres", meetings: row.meetings, latencyMs: Date.now() - started };
});
