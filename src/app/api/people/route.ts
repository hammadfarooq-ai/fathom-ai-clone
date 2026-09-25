import { route } from "@/server/http";
import { listPeople } from "@/server/meetings";

export const GET = route(async () => listPeople());
