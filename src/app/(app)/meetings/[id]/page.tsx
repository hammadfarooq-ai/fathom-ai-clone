import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingWorkspace } from "@/components/meeting/workspace";
import { findMeeting } from "@/data";

export async function generateMetadata({ params }: PageProps<"/meetings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meeting = findMeeting(id);
  return { title: meeting?.title ?? "Meeting not found" };
}

export default async function MeetingPage({ params, searchParams }: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const meeting = findMeeting(id);
  if (!meeting) notFound();

  const t = Number(Array.isArray(sp.t) ? sp.t[0] : sp.t);
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const initialTime = Number.isFinite(t) && t >= 0 && t <= meeting.durationSec ? t : undefined;

  return <MeetingWorkspace meeting={meeting} initialTime={initialTime} initialQuery={q} />;
}
