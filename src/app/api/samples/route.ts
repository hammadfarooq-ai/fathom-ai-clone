import { route } from "@/server/http";
import { listSampleRecordings } from "@/server/workspace";

/** Sample calls the stubbed notetaker can "record". */
export const GET = route(async () => listSampleRecordings());
