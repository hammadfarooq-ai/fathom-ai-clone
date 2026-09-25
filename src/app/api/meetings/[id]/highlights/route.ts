import { z } from "zod";
import { body, created, route } from "@/server/http";
import { createHighlight } from "@/server/workspace";

export const POST = route(async (req, ctx: RouteContext<"/api/meetings/[id]/highlights">) => {
  const { id } = await ctx.params;
  const input = await body(
    req,
    z
      .object({
        /** Passing an id re-creates a highlight (used by Undo). */
        id: z.string().max(80).optional(),
        transcriptEntryId: z.string().optional(),
        start: z.number().min(0),
        end: z.number().min(0),
        title: z.string().trim().min(1).max(160),
        description: z.string().max(1000).optional(),
      })
      .refine((h) => h.end >= h.start, "end must be after start"),
  );
  return created(await createHighlight(id, input));
});
