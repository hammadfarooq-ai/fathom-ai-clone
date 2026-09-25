import { z } from "zod";
import { ask } from "@/server/ask";
import { body, route } from "@/server/http";

/** POST /api/ask { question, meetingId? } — cited answers from meeting data. */
export const POST = route(async (req) => {
  const { question, meetingId } = await body(req, z.object({ question: z.string().trim().min(1).max(500), meetingId: z.string().optional() }));
  return ask(question, meetingId);
});
