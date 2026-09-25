import { route } from "@/server/http";
import { getOverviewStats } from "@/server/workspace";

export const GET = route(async () => getOverviewStats());
