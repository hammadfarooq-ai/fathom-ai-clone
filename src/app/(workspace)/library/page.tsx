import type { Metadata } from "next";
import { Suspense } from "react";
import { SWRConfig } from "swr";
import { LibraryView } from "@/components/library/library";
import { meetingsKey } from "@/lib/keys";
import { listMeetings } from "@/server/meetings";
import type { MeetingType } from "@/types";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters = {
    q: one(sp.q)?.trim() || undefined,
    type: (one(sp.type) as MeetingType) || undefined,
    scope: (one(sp.scope) as "external" | "internal") || undefined,
  };
  const meetings = await listMeetings(filters).catch(() => []);
  return (
    <SWRConfig value={{ fallback: { [meetingsKey(filters)]: meetings } }}>
      <Suspense>
        <LibraryView />
      </Suspense>
    </SWRConfig>
  );
}
