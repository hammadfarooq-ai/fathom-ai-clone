import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findMeeting, getAllKnownMeetings, seededClips, seededMeetings } from "@/data";
import { askAcrossMeetings, askMeeting } from "@/lib/ask";
import { encodeClipId, resolveClip } from "@/lib/clips";
import { searchMeetings } from "@/lib/search";
import { buildSummary, TEMPLATES } from "@/lib/templates";

const q4 = findMeeting("q4-product-strategy")!;

describe("seeded data", () => {
  it("has 12 workspace meetings with consistent transcripts", () => {
    assert.equal(seededMeetings.length, 12);
    for (const m of getAllKnownMeetings()) {
      assert.ok(m.transcript.length >= 10, `${m.id} transcript too short`);
      for (let i = 1; i < m.transcript.length; i++) {
        assert.ok(m.transcript[i].start > m.transcript[i - 1].start, `${m.id} timestamps not increasing at ${i}`);
      }
      assert.ok(m.transcript.at(-1)!.start < m.durationSec, `${m.id} transcript runs past the recording`);
      for (const e of m.transcript) assert.ok(m.participants.includes(e.speakerId), `${m.id}: ${e.speakerId} is not a participant`);
    }
  });
});

describe("search", () => {
  it("finds pricing across titles, summaries, and transcripts", () => {
    const results = searchMeetings(seededMeetings, "pricing");
    assert.ok(results.length >= 4);
    const types = new Set(results.flatMap((r) => r.matches.map((m) => m.type)));
    for (const t of ["title", "summary", "transcript", "decision"]) assert.ok(types.has(t as never), `missing ${t} matches`);
    const transcriptHit = results.flatMap((r) => r.matches).find((m) => m.type === "transcript");
    assert.equal(typeof transcriptHit?.start, "number");
  });

  it("returns nothing for gibberish", () => {
    assert.equal(searchMeetings(seededMeetings, "zzqxv").length, 0);
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
    for (const m of getAllKnownMeetings()) {
      for (const q of m.suggestedQuestions) {
        const a = askMeeting(m, q);
        assert.doesNotMatch(a.answer, /couldn't find/, `${m.id}: "${q}" got no answer`);
      }
    }
  });
});

describe("ask across meetings", () => {
  it("surfaces customer meetings for SSO feedback", () => {
    const a = askAcrossMeetings(seededMeetings, "What did customers say about SSO?");
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

describe("clips", () => {
  it("round-trips a clip id", () => {
    const id = encodeClipId({ meetingId: "acme-product-demo", start: 212, end: 310, title: "Acme’s reporting pain — “four days stale”" });
    const resolved = resolveClip(id);
    assert.ok(resolved);
    assert.equal(resolved.meeting.id, "acme-product-demo");
    assert.equal(resolved.clip.start, 212);
    assert.equal(resolved.clip.end, 310);
    assert.equal(resolved.clip.title, "Acme’s reporting pain — “four days stale”");
  });

  it("resolves seeded clips and rejects invalid ids", () => {
    for (const c of seededClips) assert.ok(resolveClip(c.id));
    assert.equal(resolveClip("not-a-clip"), null);
    assert.equal(resolveClip("0-5w-2-QQ"), null); // end before start
  });
});
