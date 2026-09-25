import { z } from "zod";
import { body, route, schemas } from "@/server/http";
import { getSettings, updateSettings } from "@/server/workspace";

export const GET = route(async () => getSettings());

const Patch = z
  .object({
    calendars: z.object({ google: z.boolean(), outlook: z.boolean() }).partial(),
    autoRecord: z.enum(["all", "external", "none"]),
    defaultTemplate: schemas.template,
    integrations: z.object({ slack: z.boolean(), hubspot: z.boolean(), notion: z.boolean(), linear: z.boolean() }).partial(),
    notifications: z.object({ summaryEmail: z.boolean(), actionReminders: z.boolean(), weeklyDigest: z.boolean() }).partial(),
    joinAs: z.string().trim().min(1).max(60),
  })
  .partial()
  .strict();

export const PATCH = route(async (req) => updateSettings(await body(req, Patch)));
