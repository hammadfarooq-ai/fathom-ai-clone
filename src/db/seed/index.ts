import type { Clip, UpcomingMeeting } from "@/types";
import type { SeedMeeting } from "./builders";
import { launchGoNoGo } from "./meetings-large";
import { acmeProductDemo, customerDiscovery, enterpriseOnboarding, investorDiscussion } from "./meetings-customers";
import { designReview, engineeringSync, pricingWorkshop, q4ProductStrategy } from "./meetings-product";
import { hiringInterview, marketingPlanning, salesPipelineReview, weeklyOneOnOne } from "./meetings-team";
import { orbitFeedback, stacklinePartnerSync } from "./sample-recordings";

/**
 * Seed content for the demo workspace. This is only read by the seed script
 * (scripts/db-seed.ts) and by the "capture" stub, which copies a sample
 * recording into the database. The app itself reads everything from Postgres.
 *
 * Dates were authored relative to SEED_TODAY; the seed shifts them so the
 * workspace always looks current on the day it is seeded.
 */
export const SEED_TODAY = "2026-09-23";

export type { SeedMeeting };

export const seedMeetings: SeedMeeting[] = [
  launchGoNoGo,
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

/** Recordings the stubbed capture flow "records". */
export const sampleRecordings: SeedMeeting[] = [stacklinePartnerSync, orbitFeedback];

export const seedUpcoming: UpcomingMeeting[] = [
  { id: "up-1", title: "Product Standup", date: "2026-09-23T11:00:00Z", durationMin: 15, platform: "google-meet", participants: ["hammad", "marcus", "aisha", "sarah"], meetingType: "Product", autoRecord: true, calendar: "google" },
  { id: "up-2", title: "Design Handoff: SSO Edge Cases", date: "2026-09-23T14:30:00Z", durationMin: 30, platform: "google-meet", participants: ["aisha", "priya", "hammad"], meetingType: "Product", autoRecord: true, calendar: "google" },
  { id: "up-3", title: "Final Round: Nina Kowalski", date: "2026-09-24T10:00:00Z", durationMin: 60, platform: "zoom", participants: ["aisha", "marcus", "nina"], meetingType: "Interview", autoRecord: false, calendar: "google" },
  { id: "up-4", title: "Launch Readiness Review", date: "2026-09-25T09:00:00Z", durationMin: 45, platform: "zoom", participants: ["olivia", "hammad", "sarah", "marcus", "tom"], meetingType: "Product", autoRecord: true, calendar: "google" },
  { id: "up-7", title: "Pricing Page Copy Review", date: "2026-09-25T13:00:00Z", durationMin: 30, platform: "google-meet", participants: ["tom", "sarah", "hammad"], meetingType: "Marketing", autoRecord: true, calendar: "google" },
  { id: "up-8", title: "Helix SCIM Scoping", date: "2026-09-26T16:00:00Z", durationMin: 45, platform: "teams", participants: ["priya", "emily", "sam", "grace"], meetingType: "Engineering", autoRecord: true, calendar: "outlook" },
  { id: "up-5", title: "Weekly 1:1 — Hammad / Aisha", date: "2026-09-28T15:30:00Z", durationMin: 30, platform: "google-meet", participants: ["hammad", "aisha"], meetingType: "1:1", autoRecord: true, calendar: "google" },
  { id: "up-6", title: "Acme Pilot Kickoff", date: "2026-09-29T10:00:00Z", durationMin: 45, platform: "zoom", participants: ["diego", "hammad", "jordan", "lena"], meetingType: "Sales", autoRecord: true, calendar: "outlook" },
  { id: "up-9", title: "Board Prep", date: "2026-09-30T17:00:00Z", durationMin: 60, platform: "zoom", participants: ["olivia", "hammad", "sarah", "david"], meetingType: "Investor", autoRecord: false, calendar: "google" },
];

/** Clips that exist in the workspace out of the box. */
export const seedClips: Clip[] = [
  { id: "pricing-hold", meetingId: "q4-product-strategy", start: 134, end: 315, title: "Why we're holding enterprise pricing" },
  { id: "acme-pain", meetingId: "acme-product-demo", start: 212, end: 400, title: "Acme's manual reporting pain" },
  { id: "sso-healthcare", meetingId: "customer-discovery-brightline", start: 1065, end: 1215, title: "SSO is non-negotiable in healthcare" },
];
