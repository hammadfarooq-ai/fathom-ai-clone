# Parley

**Meeting notes you can search, question, and share.**

**Live demo:** _(added after deployment)_

Parley records a meeting and turns it into notes, a synced transcript, action items, highlights, and shareable clips. You can search everything that was said and ask questions that are answered with quotes from the transcript.

This is the resubmission. The first version followed the look of the product it was modelled on and kept its data in the browser. This version has:

1. **A new interface designed from scratch**, with its own layout and visual language (details below).
2. **A real backend**: Postgres with migrations, a REST API, and full-text search in the database. Nothing is mocked in the browser. Every read and write goes through the API.

---

## The design

I wanted it to feel like a well-kept notebook, not a video app.

- **Paper and ink.** Warm paper surfaces and near-black ink. There is one accent colour, vermilion, and it only marks things that are live or current: the Capture button, the playhead, and the line being spoken. Saved moments and search matches use highlighter yellow, the way you'd mark a printed transcript.
- **Type does the work.** Headlines are set in Instrument Serif, and the UI and transcript text are in Geist. Section labels are small caps above a ruled line, so pages read like a document instead of a grid of cards.
- **No sidebar.** A top bar holds four places: **Today**, **Library**, **Moments**, and **Ask**. There's also a ⌘K palette and a Capture button. On phones, the four places move to a bottom tab bar.
- **The tape deck.** On a meeting page, the player is docked at the bottom. Every participant gets a lane that shows exactly when they spoke. Above the lanes are chapters and highlight markers, and the playhead runs through all of them. This is built for the hard case, an eight-person call that runs an hour: you can see the shape of the conversation, jump to anyone's next turn, and see who dominated which chapter. On small screens the lanes fold into a single colour ribbon.
- **Notes left, transcript right.** Notes are the main reading surface. The transcript follows playback, pauses following when you scroll away, and gives you a "Follow playback" button to return. Hover any line to highlight it, clip from it, or copy a link to that moment. Press **H** to highlight what's playing.
- Light and dark themes follow the OS. The toggle is stored in a cookie, so the server renders the right palette and nothing flashes on load.

| Page | What it's for |
| --- | --- |
| **Today** | Greeting, a week-at-a-glance stat strip, the calendar agenda with a per-event "record" switch, recently captured meetings with talk-time strips, and your follow-ups grouped Overdue / This week / Later. |
| **Library** | Every meeting as a ledger, grouped by date. Filter by anything that was said (Postgres FTS), by who was there (customers or internal), and by meeting type. The URL keeps the filters, so a filtered view can be shared. |
| **Meeting** | Template-driven notes (six templates), interactive action items (tick off, add, delete, find in transcript), highlights, the synced transcript with in-meeting search, "Ask this meeting", clip creation, rename, delete, and transcript download. |
| **Moments** | Saved highlights as quote cards, and shared clips with their view counts. |
| **Ask** | Questions across every meeting. Answers cite numbered transcript lines that open at the exact moment. |
| **Search** | Full results by match type (title, summary, decision, chapter, transcript, action item, highlight) with highlighted snippets. |
| **Settings** | Calendars, recording rules, notetaker name, default template, notifications, integrations, and a workspace reset. |
| **`/c/<id>`** | A public clip page: no sign-in, plays only the clipped range, and shows that part of the transcript. |

## The backend

```
Browser (SWR) ──► Next.js Route Handlers (/api/*) ──► src/server/* ──► Postgres (Drizzle ORM)
     ▲                                                                     │
     └──── pages render on the server with the same data layer ◄───────────┘
```

- **Postgres + Drizzle ORM.** Nine tables: `people`, `meetings`, `meeting_participants`, `transcript_entries`, `action_items`, `highlights`, `clips`, `calendar_events`, `workspace_settings`. The migrations are SQL files in [`drizzle/`](drizzle/).
- **Search runs in the database.** `meetings.search_vector` (weighted title > summary/decisions > takeaways/chapters/tags) and `transcript_entries.search_vector` are generated `tsvector` columns with GIN indexes. Queries are prefix tsqueries, so results update as you type. `ts_headline` produces the snippets, with `⟦ ⟧` delimiters that the client renders as marks, so no HTML is injected.
- **Ask is retrieval, then synthesis.** Postgres ranks candidate meetings for the question. The deterministic engine in [`src/lib/ask.ts`](src/lib/ask.ts) then scores decisions, takeaways, action items, and transcript lines, and composes an answer with citations. If `ANTHROPIC_API_KEY` is set, Claude rewrites that answer using only the retrieved lines. Any failure falls back to the local answer.
- **Transcript import is a real pipeline.** Paste or upload WebVTT, SRT, `[mm:ss] Name: text`, or plain `Name: text`. The server parses it, matches speakers to people (unknown names become guests), stores the meeting as *processing*, and responds right away. It then writes the notes after the response using Next's `after()`. With `ANTHROPIC_API_KEY` set, Claude extracts the notes through a structured-output schema. Without it, a local extractive analyzer finds the summary, decisions ("we decided…"), owned action items ("I'll…" / "can you…", with weekday due dates), chapters, and tags.
- **Talk time is computed in SQL** with a window function (each line lasts until the next line starts), and it feeds the library strips and the player lanes.
- **Clips** have short random ids. The public page increments a view counter in the database.
- **Validation and errors.** Every endpoint validates input with zod and returns `{ error, issues? }` with a proper status code (400, 404, 422, or 500).

### API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/meetings?q=&type=&scope=` | List with talk time, action counts, and processing state |
| POST | `/api/meetings` | `{kind:"capture"}` stubbed notetaker, or `{kind:"import"}` transcript import |
| GET / PATCH / DELETE | `/api/meetings/:id` | Full meeting / rename or switch template / delete |
| POST | `/api/meetings/:id/action-items` | Add an action item |
| GET | `/api/action-items?status=open` | Across all meetings |
| PATCH / DELETE | `/api/action-items/:id` | Complete, edit, delete |
| POST | `/api/meetings/:id/highlights` | Save a highlight (re-posting with an id restores one, for Undo) |
| GET / DELETE | `/api/highlights`, `/api/highlights/:id` | |
| GET / POST | `/api/clips` | |
| GET / DELETE | `/api/clips/:id` | |
| GET | `/api/calendar/events` · PATCH `/api/calendar/events/:id` | Agenda and per-event auto-record |
| GET / PATCH | `/api/settings` | |
| GET | `/api/search?q=` | Full-text search |
| POST | `/api/ask` | `{question, meetingId?}` |
| GET | `/api/people`, `/api/overview`, `/api/samples`, `/api/health` | |
| POST | `/api/workspace/reset` | Reseed the demo with dates moved to today |

## What's real and what's stubbed

Real: the database, every API route, search, Ask, transcript import and analysis, action items, highlights, clips and view counts, templates, settings, and the calendar agenda's auto-record switches.

Stubbed, on purpose:

- **The recording bot.** Getting a bot into Zoom, Meet, or Teams needs platform approval and media infrastructure. "Join a call" validates the link and then records one of two bundled sample calls, and everything after that is the real pipeline. **Import a transcript** covers real meetings end to end.
- **Audio/video.** Seeded meetings have no media files, so playback follows the transcript clock. `recording_url` is in the schema, and the player switches to a real `<audio>` element when it's set.
- **Calendar OAuth and integrations.** The switches are saved in the database, but no external account is connected.
- **Accounts.** It's a single-user workspace with no sign-in, as in the first submission.

## Seed data

A fictional company, **Northstack**, with 13 cross-referenced meetings. Pricing decided in one meeting shows up in the pipeline review, and the Helix pilot feeds the launch plan. The seed also includes an eight-person, hour-long **Launch Go/No-Go**. The seed shifts every date so the workspace looks current on the day it's seeded.

## Running locally

Requires Node.js 20.9+ and Postgres 14+.

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL
npm run db:setup                  # apply migrations and load the demo workspace
npm run dev                       # http://localhost:3000
```

| Script | |
| --- | --- |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Wipe and reload the demo workspace |
| `npm run db:deploy` | Migrate, then seed only if the database is empty (used on deploy) |
| `npm run db:generate` | Generate a migration after changing `src/db/schema.ts` |
| `npm test` | Unit tests (no DB) plus integration tests against Postgres |
| `npm run lint` / `npm run typecheck` / `npm run build` | |

Integration tests only touch rows they create, and they remove them afterwards.

## Deploying

Any Node host with Postgres works. On Vercel, add a Postgres database (for example, Neon from the Vercel Marketplace), which sets `DATABASE_URL`, then deploy. The `vercel-build` script runs `db:deploy` before `next build`, so the schema and demo data are created on the first deploy. Later deploys never wipe data.

## Project layout

```
drizzle/                 SQL migrations
scripts/                 migrate / seed / deploy, and the agent-log capture hook
src/app/(workspace)/     Today, Library, Meeting, Moments, Ask, Search, Settings
src/app/c/[id]/          public clip page
src/app/api/             REST API (Route Handlers)
src/components/          UI, by feature; ui/ holds primitives
src/db/                  schema, client, seed content
src/lib/                 client API hooks, ask engine, templates, timeline, formatting
src/server/              data access, search, ask, transcript analysis, seeding
tests/                   unit + integration tests
.agent-logs/             coding-agent session logs
```

## Working with AI agents

The code was written with Claude Code. `.agent-logs/` holds one file per session: every prompt verbatim and the final response of each turn, captured by the hook in [`scripts/agent-log.mjs`](scripts/agent-log.mjs) (see [`CAPTURE-TEST.md`](CAPTURE-TEST.md)). The logs are committed alongside the code they produced.
