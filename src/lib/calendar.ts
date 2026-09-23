/**
 * Calendar integration seam.
 *
 * A real deployment implements `CalendarProvider` with OAuth (Google:
 * https://www.googleapis.com/auth/calendar.readonly, Microsoft Graph:
 * Calendars.Read), stores tokens server-side, and syncs events into
 * `UpcomingMeeting` records. In this demo the provider is mocked so the
 * connect/disconnect UX works without credentials.
 */

export type CalendarProviderId = "google" | "outlook";

export interface CalendarProvider {
  id: CalendarProviderId;
  name: string;
  /** Starts the OAuth flow; resolves with the connected account email. */
  connect(): Promise<{ account: string }>;
  disconnect(): Promise<void>;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockProvider(id: CalendarProviderId, name: string, account: string): CalendarProvider {
  return {
    id,
    name,
    async connect() {
      await delay(1200);
      return { account };
    },
    async disconnect() {
      await delay(400);
    },
  };
}

export const calendarProviders: Record<CalendarProviderId, CalendarProvider> = {
  google: mockProvider("google", "Google Calendar", "hammad@northstack.io"),
  outlook: mockProvider("outlook", "Outlook Calendar", "hammad@northstack.onmicrosoft.com"),
};
