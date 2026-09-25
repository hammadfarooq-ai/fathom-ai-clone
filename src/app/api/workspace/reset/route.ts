import { route } from "@/server/http";
import { resetWorkspace } from "@/server/workspace";

/** POST /api/workspace/reset — reload the demo workspace with dates shifted to today. */
export const POST = route(async () => resetWorkspace());
