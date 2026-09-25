import { z } from "zod";
import { CURRENT_USER_ID } from "@/lib/constants";
import { body, created, route, schemas } from "@/server/http";
import { createActionItem } from "@/server/workspace";

export const POST = route(async (req, ctx: RouteContext<"/api/meetings/[id]/action-items">) => {
  const { id } = await ctx.params;
  const input = await body(
    req,
    z.object({ title: z.string().trim().min(2).max(200), ownerId: z.string().default(CURRENT_USER_ID), dueDate: schemas.isoDate }),
  );
  return created(await createActionItem(id, input));
});
