import { route } from "@/server/http";
import { deleteClip, getClip, NotFoundError } from "@/server/workspace";

type Ctx = RouteContext<"/api/clips/[id]">;

export const GET = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const clip = await getClip(id);
  if (!clip) throw new NotFoundError("Clip");
  return clip;
});

export const DELETE = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteClip(id);
});
