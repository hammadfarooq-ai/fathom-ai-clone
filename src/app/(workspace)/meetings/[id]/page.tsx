import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SWRConfig } from "swr";
import { MeetingView } from "@/components/meeting/meeting-view";
import { getMeeting, getProcessing } from "@/server/meetings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/meetings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  return { title: meeting?.title ?? "Meeting not found" };
}

export default async function MeetingPage({ params, searchParams }: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const [processing, meeting] = await Promise.all([getProcessing(id), getMeeting(id)]);
  if (!meeting) notFound();

  const t = Number(Array.isArray(sp.t) ? sp.t[0] : sp.t);
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const initialTime = Number.isFinite(t) && t >= 0 && t <= meeting.durationSec ? t : undefined;

  return (
    <SWRConfig value={{ fallback: { [`/api/meetings/${id}`]: { ...meeting, processing: processing ?? undefined } } }}>
      <MeetingView id={id} initialTime={initialTime} initialQuery={q} />
    </SWRConfig>
  );
}
