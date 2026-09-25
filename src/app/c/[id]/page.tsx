import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipView } from "@/components/clip/clip-view";
import { getMeeting } from "@/server/meetings";
import { getClip } from "@/server/workspace";

/** Public, read-only clip page: no app shell, no sign-in. */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/c/[id]">): Promise<Metadata> {
  const { id } = await params;
  const clip = await getClip(id);
  return { title: clip?.title ?? "Clip not found", description: clip ? "A moment shared from a meeting on Parley." : undefined };
}

export default async function ClipPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  const clip = await getClip(id, { countView: true });
  if (!clip) notFound();
  const meeting = await getMeeting(clip.meetingId);
  if (!meeting) notFound();
  return <ClipView meeting={meeting} clip={clip} />;
}
