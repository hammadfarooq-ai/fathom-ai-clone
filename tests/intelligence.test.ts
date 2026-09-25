import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sampleRecordings, seedMeetings } from "@/db/seed";
import type { SeedMeeting } from "@/db/seed/builders";
import { seedPeople } from "@/db/seed/people";
import { askAcrossMeetings, askMeeting } from "@/lib/ask";
import { buildSummary, TEMPLATES } from "@/lib/templates";
import { analyzeLocally, parseTranscript } from "@/server/analyze";
import { tsQuery } from "@/server/text-search";
import type { Meeting } from "@/types";

/**
 * Unit tests for the intelligence layer. These run without a database: seed
 * meetings are hydrated with their people the same way the data layer does.
 */

const people = Object.fromEntries(seedPeople.map((p) => [p.id, p]));
const hydrate = (m: SeedMeeting): Meeting => ({ ...m, people, status: "ready", source: "seed" });
const meetings = seedMeetings.map(hydrate);
const all = [...seedMeetings, ...sampleRecordings].map(hydrate);
const q4 = meetings.find((m) => m.id === "q4-product-strategy")!;

describe("seed data", () => {
  it("has consistent transcripts", () => {
    assert.ok(meetings.length >= 12);
    for (const m of all) {
      assert.ok(m.transcript.length >= 10, `${m.id} transcript too short`);
      for (let i = 1; i < m.transcript.length; i++) {
        assert.ok(m.transcript[i].start > m.transcript[i - 1].start, `${m.id} timestamps not increasing at ${i}`);
      }
      assert.ok(m.transcript.at(-1)!.start < m.durationSec, `${m.id} transcript runs past the recording`);
      for (const e of m.transcript) assert.ok(m.participants.includes(e.speakerId), `${m.id}: ${e.speakerId} is not a participant`);
      for (const p of m.participants) assert.ok(people[p], `${m.id}: unknown person ${p}`);
    }
  });
});

describe("ask this meeting", () => {
  it("answers the enterprise pricing decision with owner, date, and source", () => {
    const a = askMeeting(q4, "What did we decide about enterprise pricing?");
    assert.match(a.answer, /Enterprise pricing stays unchanged for the October launch/);
    assert.match(a.answer, /Sarah will prepare the final pricing proposal/);
    assert.equal(a.sources[0].start, 134);
    assert.equal(a.sources[0].label, "Enterprise pricing discussion");
  });

  it("answers timeline questions with the launch date", () => {
    assert.match(askMeeting(q4, "When is the enterprise launch?").answer, /October 20/);
  });

  it("lists action items for next-steps questions", () => {
    assert.match(askMeeting(q4, "What are the next steps?").answer, /action items/);
  });

  it("says so when nothing matches", () => {
    const a = askMeeting(q4, "bananas");
    assert.match(a.answer, /couldn't find/);
    assert.equal(a.sources.length, 0);
  });

  it("answers every suggested question for every meeting", () => {
    for (const m of all) {
      for (const q of m.suggestedQuestions) {
        assert.doesNotMatch(askMeeting(m, q).answer, /couldn't find/, `${m.id}: "${q}" got no answer`);
      }
    }
  });
});

describe("ask across meetings", () => {
  it("surfaces customer meetings for SSO feedback", () => {
    const a = askAcrossMeetings(meetings, "What did customers say about SSO?");
    const ids = a.meetings!.map((m) => m.meetingId);
    assert.ok(ids.includes("customer-discovery-brightline"));
    assert.ok(ids.includes("acme-product-demo"));
    assert.ok(a.sources.every((s) => typeof s.start === "number"));
  });
});

describe("templates", () => {
  it("each template produces a different section layout", () => {
    const layouts = TEMPLATES.map((t) => buildSummary(q4, t.id).map((s) => s.title).join("|"));
    assert.equal(new Set(layouts).size, TEMPLATES.length);
  });
});

describe("full-text query builder", () => {
  it("builds prefix queries and strips operators", () => {
    assert.equal(tsQuery("SSO pricing"), "sso:* & pricing:*");
    assert.equal(tsQuery("a | b & !c"), null);
    assert.equal(tsQuery("helix's rollout", "any"), "helix:* | rollout:*");
    assert.equal(tsQuery("   "), null);
  });
});

describe("transcript import", () => {
  it("parses bracketed timestamps, VTT cues, and plain speaker lines", () => {
    const bracketed = parseTranscript("[00:05] Ana: Hello there.\n[01:10] Ben: Hi Ana.\ncontinuation line");
    assert.deepEqual(
      bracketed.map((l) => [l.start, l.speaker]),
      [
        [5, "Ana"],
        [70, "Ben"],
      ],
    );
    assert.match(bracketed[1].text, /continuation line$/);

    const vtt = parseTranscript("WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Ana>Welcome everyone</v>\n\n2\n00:00:05.500 --> 00:00:08.000\n<v Ben>Thanks</v>");
    assert.deepEqual(vtt.map((l) => [l.start, l.speaker, l.text]), [
      [1, "Ana", "Welcome everyone"],
      [5, "Ben", "Thanks"],
    ]);

    const plain = parseTranscript("Ana: One two three four five.\nBen: Six seven.");
    assert.equal(plain[0].start, 0);
    assert.ok(plain[1].start > 0, "times are estimated from speaking rate");
  });

  it("extracts decisions and owned action items locally", () => {
    const lines = parseTranscript(
      [
        "[00:00] Ana: We need to fix onboarding because 42% of trials never invite a teammate.",
        "[00:20] Ben: The invite step is buried behind three settings screens today.",
        "[00:40] Ana: Okay, we decided to move invites into the first-run checklist.",
        "[01:00] Ben: I'll write the spec for the new checklist by Friday.",
        "[01:20] Ana: Can you also draft the nudge email copy?",
        "[01:30] Ben: Sure, happy to.",
      ].join("\n"),
    );
    const ids: Record<string, string> = { Ana: "ana", Ben: "ben" };
    const notes = analyzeLocally({
      title: "Onboarding",
      date: "2026-09-21T10:00:00Z", // a Monday
      meetingType: "Product",
      durationSec: 100,
      speakers: { ana: "Ana", ben: "Ben" },
      lines: lines.map((l, i) => ({ id: `t${i}`, start: l.start, speakerId: ids[l.speaker], text: l.text })),
    });
    assert.equal(notes.keyDecisions.length, 1);
    assert.match(notes.keyDecisions[0], /move invites/);
    const spec = notes.actionItems.find((a) => /spec/.test(a.title));
    assert.equal(spec?.ownerId, "ben");
    assert.equal(spec?.dueDate, "2026-09-25", "“by Friday” resolves to that week's Friday");
    assert.equal(spec?.title, "Write the spec for the new checklist");
    const nudge = notes.actionItems.find((a) => /nudge/.test(a.title));
    assert.equal(nudge?.ownerId, "ben", "a request is owned by the person who answers it");
    assert.ok(notes.summary.length > 20);
  });
});
