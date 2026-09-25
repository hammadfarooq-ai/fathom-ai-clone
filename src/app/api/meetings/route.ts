import { after } from "next/server";
import { z } from "zod";
import { body, created, query, route, schemas } from "@/server/http";
import { listMeetings } from "@/server/meetings";
import { importTranscript, startCapture } from "@/server/workspace";

/** GET /api/meetings?q=&type=&scope=all|external|internal */
export const GET = route(async (req) => {
  const filters = query(
    req,
    z.object({
      q: z.string().trim().max(200).optional(),
      type: schemas.meetingType.optional(),
      scope: z.enum(["all", "external", "internal"]).optional(),
    }),
  );
  return listMeetings(filters);
});

const CreateMeeting = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("capture"),
    sampleId: z.string(),
    title: z.string().trim().max(160).optional(),
    platform: schemas.platform,
  }),
  z.object({
    kind: z.literal("import"),
    title: z.string().trim().min(1).max(160),
    meetingType: schemas.meetingType.default("Product"),
    transcript: z.string().min(10).max(400_000),
    date: z.iso.datetime().optional(),
  }),
]);

/**
 * POST /api/meetings
 * - { kind: "capture" }: the stubbed notetaker "records" a bundled sample call.
 * - { kind: "import" }: a pasted/uploaded transcript is parsed and stored now;
 *   notes are generated after the response and the meeting flips to ready.
 */
export const POST = route(async (req) => {
  const input = await body(req, CreateMeeting);
  if (input.kind === "capture") return created(await startCapture(input));
  const { id, analyze } = await importTranscript(input);
  after(analyze);
  return created({ id });
});
