import { z } from "zod";
import { body, route } from "@/server/http";
import { setAutoRecord } from "@/server/workspace";

export const PATCH = route(async (req, ctx: RouteContext<"/api/calendar/events/[id]">) => {
  const { id } = await ctx.params;
  const { autoRecord } = await body(req, z.object({ autoRecord: z.boolean() }));
  await setAutoRecord(id, autoRecord);
  return { id, autoRecord };
});
