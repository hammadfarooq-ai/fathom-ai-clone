import { z } from "zod";
import { body, created, route } from "@/server/http";
import { createClip, listClips } from "@/server/workspace";

export const GET = route(async () => listClips());

export const POST = route(async (req) => {
  const input = await body(
    req,
    z.object({ meetingId: z.string(), start: z.number().min(0), end: z.number().min(0), title: z.string().trim().min(1).max(160) }),
  );
  return created(await createClip(input));
});
