import type { Metadata } from "next";
import { MeetingsList } from "@/components/meetings/meetings-list";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return <MeetingsList />;
}
