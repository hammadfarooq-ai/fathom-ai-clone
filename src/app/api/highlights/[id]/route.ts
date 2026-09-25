import { route } from "@/server/http";
import { deleteHighlight } from "@/server/workspace";

/** DELETE returns the removed highlight so the client can offer Undo. */
export const DELETE = route(async (_req, ctx: RouteContext<"/api/highlights/[id]">) => {
  const { id } = await ctx.params;
  return deleteHighlight(id);
});
