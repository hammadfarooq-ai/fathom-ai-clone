import { defineMeeting } from "./builders";

/**
 * Recordings used by the stubbed capture flow ("New meeting"). They are not
 * shown in the workspace until a user "records" or "imports" one.
 */
export const stacklinePartnerSync = defineMeeting({
  id: "partner-sync-stackline",
  title: "Partner Sync: Stackline",
  date: "2026-09-23T09:00:00Z",
  duration: "24:30",
  meetingType: "Sales",
  platform: "zoom",
  hostId: "hammad",
  participants: ["hammad", "diego", "kofi"],
  template: "general",
  tags: ["partnership", "integration"],
  tone: "Friendly · exploratory",
  summary:
    "Hammad and Diego met Kofi Mensah from Stackline to explore a native integration. About 300 Stackline teams have requested analytics exports, mostly mid-market — a strong fit for Pro+. Northstack will build a connector on Stackline's stable API first and add webhooks once they're GA. The companies agreed to a joint webinar in November and a simple per-deal referral arrangement.",
  keyDecisions: [
    "Build the connector on Stackline's API first; add webhooks after they reach GA.",
    "A joint webinar is planned for November, after the enterprise launch.",
    "Draft a flat-fee-per-deal referral agreement.",
  ],
  takeaways: [
    "About 300 Stackline teams asked for analytics exports in the last six months.",
    "The audience is primarily mid-market, aligned with Pro+.",
  ],
  topics: [
    ["00:00", "Introductions"],
    ["02:00", "Integration scope"],
    ["10:40", "Co-marketing"],
    ["18:30", "Next steps"],
  ],
  actions: [
    ["Send a technical proposal for the Stackline connector", "hammad", "2026-10-07"],
    ["Draft the referral agreement", "diego", "2026-10-02"],
    ["Send API docs and sandbox access", "kofi", "2026-09-24"],
  ],
  highlights: [["06:30", "300 teams asked for analytics exports", "Mostly mid-market — a natural fit for Pro+.", "hammad"]],
  suggestedQuestions: ["What did Stackline propose?", "What are the next steps?", "When is the joint webinar?"],
  lines: [
    ["00:10", "kofi", "Thanks for making time. Stackline customers keep asking to push pipeline metrics into an analytics layer, and your name comes up a lot."],
    ["00:40", "hammad", "Glad to hear it. What would the integration look like from your side?"],
    ["02:00", "kofi", "A native connector. Our customers would authorize Northstack from inside Stackline, and pipeline run data would flow in automatically."],
    ["03:30", "hammad", "We can build that on our connector framework. The main question is whether you expose run metadata through an API or through webhooks."],
    ["04:40", "kofi", "Both. The API is stable; webhooks are in beta but will be GA next month."],
    ["06:10", "diego", "How many of your customers would use it?"],
    ["06:30", "kofi", "About three hundred teams have asked for analytics exports in the last six months. Most are mid-market."],
    ["08:00", "hammad", "That's a strong fit for our Pro-plus tier. I'd start with the API and add webhooks once they're GA."],
    ["10:40", "kofi", "On co-marketing, we'd love a joint webinar and a listing in our integrations directory at launch."],
    ["12:10", "diego", "We can do a joint webinar in November. Our October calendar is full with the enterprise launch."],
    ["14:30", "kofi", "November works. Could we also do a referral arrangement for mid-market deals?"],
    ["15:20", "diego", "Yes, let's draft a simple referral agreement — a flat fee per closed deal to start."],
    ["18:30", "hammad", "Next steps: we'll scope the connector and send a technical proposal in two weeks."],
    ["19:40", "kofi", "Great. I'll send API docs and a sandbox account today."],
    ["23:00", "hammad", "Thanks, Kofi. Excited about this."],
  ],
});

export const orbitFeedback = defineMeeting({
  id: "product-feedback-orbit",
  title: "Product Feedback: Orbit Labs",
  date: "2026-09-23T11:00:00Z",
  duration: "21:15",
  meetingType: "Research",
  platform: "teams",
  hostId: "emily",
  participants: ["emily", "aisha", "maya"],
  template: "research",
  tags: ["feedback", "mobile", "sso"],
  tone: "Candid · constructive",
  summary:
    "Emily and Aisha gathered six-month feedback from Maya Torres at Orbit Labs. Scheduled reports are the standout win, while mobile dashboards and surprise compute overage charges are the biggest frustrations. Orbit now requires Okta SSO and wants mobile-friendly dashboards; Aisha will run on-site observation with their warehouse leads.",
  keyDecisions: [
    "Enable usage alerts for Orbit's workspace to prevent overage surprises.",
    "Aisha will observe Orbit's warehouse leads on-site for mobile research.",
  ],
  takeaways: [
    "Mobile readability is a real gap for frontline users.",
    "Compute overage is not visible enough before invoicing.",
    "Orbit's security team now mandates Okta SSO.",
  ],
  topics: [
    ["00:00", "Introductions"],
    ["01:40", "What's working"],
    ["07:50", "Frustrations"],
    ["14:30", "Requests"],
    ["19:00", "Wrap-up"],
  ],
  actions: [
    ["Set up usage alerts for Orbit Labs", "emily", "2026-09-24"],
    ["Schedule an on-site mobile research visit", "aisha", "2026-10-01"],
    ["Send the feedback summary to Maya", "emily", "2026-09-23"],
  ],
  highlights: [["07:50", "Mobile dashboards are hard to use", "Warehouse leads live on their phones; charts get squished.", "aisha"]],
  suggestedQuestions: ["What are Orbit's frustrations?", "What did Maya say about SSO?", "What's working well?"],
  lines: [
    ["00:10", "emily", "Thanks for joining, Maya. We're six months into your rollout, so we'd love honest feedback."],
    ["01:40", "maya", "Scheduled reports are the big win. My ops leads get their Monday numbers without asking anyone."],
    ["03:10", "aisha", "Which dashboards get used most?"],
    ["03:30", "maya", "Fulfillment speed and returns. Those two get opened every day by about forty people."],
    ["07:50", "maya", "Frustrations: mobile. Our warehouse leads live on their phones, and dashboards are hard to read on a small screen."],
    ["09:20", "aisha", "Is it the charts themselves or the navigation?"],
    ["09:40", "maya", "Both. The charts get squished, and filters are hard to tap."],
    ["11:30", "maya", "The other one is pricing clarity. We didn't realize compute overage existed until we saw an invoice."],
    ["12:45", "emily", "That's on us. I'll set up usage alerts for your workspace so you see it coming."],
    ["14:30", "maya", "Requests: SSO — our security team finally mandated Okta for everything. And mobile-friendly dashboards."],
    ["15:40", "aisha", "SSO ships in October with Pro-plus. Mobile layouts are on our research list — could we observe your warehouse leads using the app?"],
    ["16:30", "maya", "Yes, come visit. They'd love to be heard."],
    ["19:00", "emily", "Thanks, Maya. I'll send a summary and the usage alert setup today."],
  ],
});
