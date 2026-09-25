import "../scripts/env.mts";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { getDb } from "@/db";
import { getMeeting, listMeetings } from "@/server/meetings";
import { searchWorkspace } from "@/server/text-search";
import {
  createActionItem,
  createClip,
  createHighlight,
  deleteActionItem,
  deleteClip,
  deleteHighlight,
  deleteMeeting,
  getClip,
  importTranscript,
  updateActionItem,
} from "@/server/workspace";

/**
 * Integration tests against the real Postgres database (DATABASE_URL).
 * They expect a seeded workspace (`npm run db:setup`) and only touch rows
 * they create, removing them afterwards. Skipped when no database is set.
 */

const skip = !process.env.DATABASE_URL && "DATABASE_URL is not set";

describe("database-backed workspace", { skip }, () => {
  after(async () => {
    await getDb().$client.end();
  });

  it("lists meetings with talk time and action counts", async () => {
    const list = await listMeetings();
    assert.ok(list.length >= 12);
    const q4 = list.find((m) => m.id === "q4-product-strategy")!;
    assert.ok(q4.totalActions > 0);
    const share = q4.talkTime.reduce((a, t) => a + t.share, 0);
    assert.ok(Math.abs(share - 1) < 0.001, "talk time shares add up to 1");
  });

  it("filters meetings with full-text search and scope", async () => {
    const external = await listMeetings({ q: "SSO", scope: "external" });
    assert.ok(external.some((m) => m.id === "customer-discovery-brightline"));
    assert.ok(!external.some((m) => m.id === "engineering-sync"));
  });

  it("searches titles, decisions, and transcripts with highlighted snippets", async () => {
    const { results } = await searchWorkspace("discount");
    assert.ok(results.length >= 2);
    const types = new Set(results.flatMap((r) => r.matches.map((m) => m.type)));
    assert.ok(types.has("decision") && types.has("transcript"));
    assert.ok(results[0].matches.some((m) => m.text.includes("⟦")));
    const line = results.flatMap((r) => r.matches).find((m) => m.type === "transcript");
    assert.equal(typeof line?.start, "number");
  });

  it("round-trips action items and highlights", async () => {
    const item = await createActionItem("q4-product-strategy", { title: "Test action from the suite", ownerId: "hammad", dueDate: "2026-10-01" });
    const done = await updateActionItem(item.id, { completed: true });
    assert.equal(done.completed, true);
    const meeting = await getMeeting("q4-product-strategy");
    assert.ok(meeting?.actionItems.some((a) => a.id === item.id && a.completed));
    await deleteActionItem(item.id);

    const h = await createHighlight("q4-product-strategy", { start: 10, end: 20, title: "Suite highlight" });
    const removed = await deleteHighlight(h.id);
    assert.equal(removed.title, "Suite highlight");
  });

  it("creates clips with a view counter", async () => {
    const clip = await createClip({ meetingId: "q4-product-strategy", start: 30, end: 60, title: "Suite clip" });
    await getClip(clip.id, { countView: true });
    const viewed = await getClip(clip.id, { countView: true });
    assert.equal(viewed?.views, 2);
    await deleteClip(clip.id);
    await assert.rejects(() => createClip({ meetingId: "q4-product-strategy", start: 30, end: 31, title: "Too short" }), RangeError);
  });

  it("imports a transcript and generates notes", async () => {
    const { id, analyze } = await importTranscript({
      title: "Suite import",
      meetingType: "Product",
      transcript: "[00:00] Hammad Farooq: We decided to ship the beta on Monday.\n[00:20] Test Guest: I'll send the release notes tomorrow.",
    });
    try {
      assert.equal((await getMeeting(id))?.status, "processing");
      await analyze();
      const meeting = await getMeeting(id);
      assert.equal(meeting?.status, "ready");
      assert.equal(meeting?.keyDecisions.length, 1);
      assert.equal(meeting?.actionItems[0]?.ownerId, "guest-test-guest");
      assert.equal(meeting?.people["guest-test-guest"]?.name, "Test Guest");
    } finally {
      await deleteMeeting(id);
    }
  });
});
