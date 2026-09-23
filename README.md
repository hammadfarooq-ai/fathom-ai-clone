# Fathom AI Clone — "Parley"

**Parley** is an AI meeting intelligence web app inspired by the Fathom workflow. It turns every meeting into searchable, actionable knowledge: recordings, transcripts, AI summaries, action items, highlights, search, question answering, and shareable clips.

It uses an original visual identity: the name, logo, and color system are its own. The workspace is seeded with a fictional company, **Northstack**, and 12 realistic, cross-referenced meetings, so it feels like a real team's workspace from the first click.

## Features

- **Meeting dashboard**: greeting, stats computed from the data, recent and upcoming meetings, open action items, recent highlights, quick search, and "Ask your meetings".
- **Meetings list**: grouped by date, with filters for external/internal and meeting type, plus text filtering.
- **Meeting detail** (the core screen):
  - Recording player: play/pause, seekable timeline with topic segments, hover previews, and highlight markers; ±10s skip, volume/mute, playback speed, and keyboard shortcuts (Space, ←/→, J/L, H).
  - Simulated video stage: active-speaker tiles and live captions driven by the transcript.
  - **Transcript**: speaker-grouped, auto-follows playback, click a timestamp to seek, search with match navigation, and per-line Highlight / Clip / Copy-link actions. Deep links (`?t=134&q=pricing`) jump to a moment.
  - **AI summary**: summary, key decisions, topics, takeaways, next steps, talk-time breakdown, and meeting tone (descriptive metadata only).
  - **Templates**: General, Sales Call, Customer Research, 1:1, Interview, and Product Meeting. Each one visibly reorganizes the summary.
  - **Action items**: complete/undo with toast + Undo, All/Open/Completed filters, and a progress bar.
  - **Highlights**: create from any transcript line, play, share as a clip, and remove with Undo.
  - **Ask this meeting**: grounded answers with clickable timestamped sources.
  - Share dialog, clip creation, copy summary, and transcript download.
- **Search**: keyword search across titles, summaries, decisions, topics, action items, highlights, and transcripts. Results are filterable by match type and show highlighted snippets; transcript results open the meeting at that timestamp. Includes a Ctrl/⌘+K command palette and a `/` shortcut.
- **Ask across meetings**: e.g. "What did customers say about SSO?" returns a synthesized answer plus source meetings with excerpts and timestamps.
- **Share clips**: pick a start/end, then get a public, read-only `/clips/<id>` page with a player limited to the clip, the transcript excerpt, and "Shared from Parley".
- **Highlights library**: aggregated across meetings, with search, meeting filter, and a shared-clips tab.
- **Settings**: Google/Outlook calendar connect/disconnect (mocked OAuth), per-meeting auto-record, recording policy, default template, integrations, notifications, and a reset for the demo workspace.
- **Stubbed meeting capture**: New meeting → Zoom / Google Meet / Teams link or upload → Recording → Transcribing → Analyzing → Ready. The meeting appears in the list (with a live "Processing" state) and opens as a full meeting.
- Loading skeletons, empty states, no-results states, a missing-meeting page, an invalid-clip page, and an error boundary.
- Responsive layout (desktop, tablet, mobile drawer navigation) and accessibility: semantic landmarks, labelled controls, keyboard support, focus rings, and reduced-motion support.

## Tech stack

- Next.js 16 (App Router, Turbopack), React 19, and TypeScript
- Tailwind CSS v4 with a custom design-token theme
- Radix UI primitives (Dialog, Dropdown Menu), Lucide icons, and Sonner toasts
- `@anthropic-ai/sdk` (optional LLM phrasing for "Ask")
- Node's built-in test runner via `tsx`

## Architecture

```
src/
  app/
    (app)/            workspace routes sharing the sidebar shell
      page.tsx        Overview
      meetings/       list + [id] detail (loading / not-found)
      search/  highlights/  settings/
    clips/[id]/       public read-only clip page (no app shell)
    api/ask/          question answering (local retrieval + optional Claude)
  components/         ui primitives, layout shell, meeting workspace, feature views
  data/               typed seed data (people, 12 meetings, sample recordings)
  lib/
    text.ts           tokenizer, stemming, synonyms
    search.ts         keyword search with match types and snippets
    ask.ts            retrieval-based Q&A (single meeting and cross-meeting)
    templates.ts      deterministic summary templates
    clips.ts          self-describing, shareable clip ids
    store.ts          client workspace state (localStorage)
    calendar.ts       CalendarProvider seam (mock OAuth)
  types/              meeting data model
tests/                intelligence-layer tests
```

- **Player**: `PlayerProvider` exposes one API (play, seek, rate, volume). When a meeting's `recording.url` is set, it drives a real `<audio>` element; otherwise it runs a simulated clock. A real capture pipeline only needs to fill in `recording.url`.
- **Ask**: every decision, takeaway, summary sentence, action item, and transcript line is a small document. Questions are tokenized and expanded with synonyms, then scored with IDF, phrase, and intent boosts (decision, owner/next steps, dates, customers, amounts). The answer is composed from the best facts and cites timestamped transcript lines. `/api/ask` always computes this locally; if `ANTHROPIC_API_KEY` is set, Claude rewrites the answer using only the retrieved context. On any failure it falls back to the local answer, and the browser falls back to local retrieval if the API is unreachable.
- **Clips**: the clip id encodes meeting, range, and title, so a shared link resolves on the server in any browser without a database.
- **State**: seeded data is immutable. User changes (completed items, highlights, clips, imports, template choice, settings) live in `lib/store.ts`, persisted to localStorage. That module is the seam for a real backend.

## Product decisions

- **Why recording/capture is stubbed.** The meeting capture layer is intentionally stubbed for this assignment. Building real Zoom/Meet/Teams bots requires platform approvals, media infrastructure, and credentials that don't fit a 24-hour build. The implementation focuses on the post-meeting intelligence experience: transcript, summary, action items, highlights, search, and sharing. The "New meeting" flow walks through the same stages a real pipeline would.
- **Why seeded data.** Evaluators should see a realistic, consistent workspace immediately, with no sign-up or API keys. The 12 meetings reference each other (pricing decided in one meeting shows up in the pipeline review, the Helix pilot result feeds the launch plan), which makes search and cross-meeting Ask meaningful.
- **Why post-meeting intelligence first.** That's where users get value: finding what was decided, who owns what, and sharing the moment that matters. That became the priority for polish.
- **Why deterministic AI.** Answers are reliable, instant, and reproducible during evaluation. The optional Claude integration shows how an LLM layers on top of the same retrieval without becoming a single point of failure.

## Running locally

Requires Node.js 20.9+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm start          # serve the production build
npm run lint       # ESLint
npm test           # intelligence-layer tests (search, ask, templates, clips)
```

To reset your local demo state, use **Settings → Reset demo workspace** (or the user menu).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | No | If set, `/api/ask` uses Claude (`claude-opus-5`) to phrase answers from the retrieved meeting context. Used only on the server. |

Copy `.env.example` to `.env.local` to set it. The app works fully without it.

## Deployment

The app is a standard Next.js project with no database and no required environment variables.

**Vercel**

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project**, then import the repository (framework preset: Next.js).
3. Optionally add `ANTHROPIC_API_KEY` under **Environment Variables**.
4. Deploy.

Or from the CLI:

```bash
npx vercel --prod
```

Any Node host also works: `npm run build && npm start`.

## Assignment note

The meeting capture/recording layer is **intentionally stubbed**, as the assignment permits. Playback is simulated from the transcript timeline (labelled "Demo recording" in the player), calendar OAuth is mocked behind a provider interface, and "New meeting" processes bundled sample recordings. Everything else, including the transcript, summaries, templates, action items, highlights, search, Ask, and clip sharing, is fully implemented and works against the seeded data.

## Known limitations

- User changes are stored in the browser (localStorage), not shared between users or devices. Shared clip links are the exception: they work anywhere because the clip is encoded in the URL.
- Light mode only.
- The share dialog's "send recap" and the calendar connection are simulated; no email or OAuth leaves the app.
