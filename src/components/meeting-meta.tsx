import { Presentation, Upload, Users, Video } from "lucide-react";
import type { MeetingType, Platform } from "@/types";
import { Badge } from "./ui/primitives";

const typeTone: Record<MeetingType, Parameters<typeof Badge>[0]["tone"]> = {
  Sales: "orange",
  Product: "brand",
  Engineering: "blue",
  Research: "violet",
  Investor: "neutral",
  "1:1": "green",
  Interview: "rose",
  Onboarding: "green",
  Marketing: "mark",
};

export function MeetingTypeBadge({ type }: { type: MeetingType }) {
  return <Badge tone={typeTone[type]}>{type}</Badge>;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  zoom: "Zoom",
  "google-meet": "Google Meet",
  teams: "Microsoft Teams",
  upload: "Uploaded file",
};

const platformIcon = { zoom: Video, "google-meet": Users, teams: Presentation, upload: Upload } satisfies Record<Platform, unknown>;

export function PlatformLabel({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = platformIcon[platform];
  return (
    <span className={className ?? "inline-flex items-center gap-1.5"}>
      <Icon className="size-3.5 text-faint" aria-hidden />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}
