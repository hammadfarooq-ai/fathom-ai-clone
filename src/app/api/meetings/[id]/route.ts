import { z } from "zod";
import { body, route, schemas } from "@/server/http";
import { getMeeting, getProcessing } from "@/server/meetings";
import { deleteMeeting, NotFoundError, updateMeeting } from "@/server/workspace";

type Ctx = RouteContext<"/api/meetings/[id]">;

/** GET /api/meetings/:id — full meeting with transcript, notes, actions, highlights. */
export const GET = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const processing = await getProcessing(id);
  const meeting = await getMeeting(id);
  if (!meeting) throw new NotFoundError("Meeting");
  return { ...meeting, processing: processing ?? undefined };
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const patch = await body(req, z.object({ title: z.string().trim().min(1).max(160).optional(), template: schemas.template.optional() }));
  await updateMeeting(id, patch);
  return getMeeting(id);
});

export const DELETE = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteMeeting(id);
});
