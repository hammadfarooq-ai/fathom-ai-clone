import type { Clip, Meeting, UpcomingMeeting } from "@/types";
import { acmeProductDemo, customerDiscovery, enterpriseOnboarding, investorDiscussion } from "./meetings-customers";
import { designReview, engineeringSync, pricingWorkshop, q4ProductStrategy } from "./meetings-product";
import { hiringInterview, marketingPlanning, salesPipelineReview, weeklyOneOnOne } from "./meetings-team";
import { orbitFeedback, stacklinePartnerSync } from "./sample-recordings";

/**
 * The fixed "today" of the demo workspace. All seeded dates are relative to it,
 * and formatting always happens in UTC so server and client render identically.
 */
export const DEMO_TODAY = "2026-09-23";

/** Meetings visible in the workspace, newest first. */
export const seededMeetings: Meeting[] = [
  acmeProductDemo,
  engineeringSync,
  q4ProductStrategy,
  weeklyOneOnOne,
  salesPipelineReview,
  hiringInterview,
  customerDiscovery,
  investorDiscussion,
  marketingPlanning,
  enterpriseOnboarding,
  pricingWorkshop,
  designReview,
].sort((a, b) => b.date.localeCompare(a.date));

/** Recordings the stubbed capture flow can "record" or "import". */
export const sampleRecordings: Meeting[] = [stacklinePartnerSync, orbitFeedback];

const allMeetings = new Map<string, Meeting>(
  [...seededMeetings, ...sampleRecordings].map((m) => [m.id, m]),
);

/** Imported copies use ids like `partner-sync-stackline--2`. */
export function baseMeetingId(id: string): string {
  return id.replace(/--\d+$/, "");
}

export function findMeeting(id: string): Meeting | undefined {
  const base = allMeetings.get(baseMeetingId(id));
  if (!base) return undefined;
  return base.id === id ? base : { ...base, id };
}

export function getAllKnownMeetings(): Meeting[] {
  return [...allMeetings.values()];
}

export const upcomingMeetings: UpcomingMeeting[] = [
  { id: "up-1", title: "Product Standup", date: "2026-09-23T11:00:00Z", durationMin: 15, platform: "google-meet", participants: ["hammad", "marcus", "aisha", "sarah"], meetingType: "Product", autoRecord: true, calendar: "Google Calendar" },
  { id: "up-2", title: "Design Handoff: SSO Edge Cases", date: "2026-09-23T14:30:00Z", durationMin: 30, platform: "google-meet", participants: ["aisha", "priya", "hammad"], meetingType: "Product", autoRecord: true, calendar: "Google Calendar" },
  { id: "up-3", title: "Final Round: Nina Kowalski", date: "2026-09-24T10:00:00Z", durationMin: 60, platform: "zoom", participants: ["aisha", "marcus", "nina"], meetingType: "Interview", autoRecord: false, calendar: "Google Calendar" },
  { id: "up-4", title: "Launch Readiness Review", date: "2026-09-25T09:00:00Z", durationMin: 45, platform: "zoom", participants: ["olivia", "hammad", "sarah", "marcus", "tom"], meetingType: "Product", autoRecord: true, calendar: "Google Calendar" },
  { id: "up-5", title: "Weekly 1:1 — Hammad / Aisha", date: "2026-09-28T15:30:00Z", durationMin: 30, platform: "google-meet", participants: ["hammad", "aisha"], meetingType: "1:1", autoRecord: true, calendar: "Google Calendar" },
  { id: "up-6", title: "Acme Pilot Kickoff", date: "2026-09-29T10:00:00Z", durationMin: 45, platform: "zoom", participants: ["diego", "hammad", "jordan", "lena"], meetingType: "Sales", autoRecord: true, calendar: "Outlook" },
];

/** Clips that exist in the workspace out of the box (short, human-friendly ids). */
export const seededClips: Clip[] = [
  { id: "pricing-hold", meetingId: "q4-product-strategy", start: 134, end: 315, title: "Why we're holding enterprise pricing" },
  { id: "acme-pain", meetingId: "acme-product-demo", start: 212, end: 400, title: "Acme's manual reporting pain" },
  { id: "sso-healthcare", meetingId: "customer-discovery-brightline", start: 1065, end: 1215, title: "SSO is non-negotiable in healthcare" },
];
