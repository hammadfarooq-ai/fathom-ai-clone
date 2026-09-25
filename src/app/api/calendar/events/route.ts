import { z } from "zod";
import { query, route } from "@/server/http";
import { listUpcoming } from "@/server/workspace";

/** Upcoming events from connected calendars (calendar sync itself is stubbed; events live in Postgres). */
export const GET = route(async (req) => {
  const { days } = query(req, z.object({ days: z.coerce.number().int().min(1).max(60).default(14) }));
  return listUpcoming({ days });
});
