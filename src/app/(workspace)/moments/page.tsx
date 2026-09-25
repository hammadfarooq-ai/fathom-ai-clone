import type { Metadata } from "next";
import { SWRConfig } from "swr";
import { MomentsView } from "@/components/moments/moments";
import { listClips, listHighlights } from "@/server/workspace";

export const metadata: Metadata = { title: "Moments" };
export const dynamic = "force-dynamic";

export default async function MomentsPage() {
  const [highlights, clips] = await Promise.all([listHighlights(), listClips()]);
  return (
    <SWRConfig value={{ fallback: { "/api/highlights": highlights, "/api/clips": clips } }}>
      <MomentsView />
    </SWRConfig>
  );
}
