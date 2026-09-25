import { route } from "@/server/http";
import { listHighlights } from "@/server/workspace";

export const GET = route(async () => listHighlights());
