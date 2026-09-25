import type { Metadata } from "next";
import { SWRConfig } from "swr";
import { Today } from "@/components/today/today";
import { listMeetings } from "@/server/meetings";
import { getOverviewStats, listActionItems, listUpcoming } from "@/server/workspace";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [events, open, meetings, stats] = await Promise.all([listUpcoming({ days: 14 }), listActionItems({ status: "open" }), listMeetings(), getOverviewStats()]);
  return (
    <SWRConfig
      value={{
        fallback: {
          "/api/calendar/events?days=14": events,
          "/api/action-items?status=open": open,
          "/api/meetings": meetings,
          "/api/overview": stats,
        },
      }}
    >
      <Today />
    </SWRConfig>
  );
}
