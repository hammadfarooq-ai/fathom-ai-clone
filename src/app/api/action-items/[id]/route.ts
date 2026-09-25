import { z } from "zod";
import { body, route, schemas } from "@/server/http";
import { deleteActionItem, updateActionItem } from "@/server/workspace";

type Ctx = RouteContext<"/api/action-items/[id]">;

export const PATCH = route(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const patch = await body(
    req,
    z.object({
      title: z.string().trim().min(2).max(200).optional(),
      ownerId: z.string().optional(),
      dueDate: schemas.isoDate.optional(),
      completed: z.boolean().optional(),
    }),
  );
  return updateActionItem(id, patch);
});

export const DELETE = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteActionItem(id);
});
