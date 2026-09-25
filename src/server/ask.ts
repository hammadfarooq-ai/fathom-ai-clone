import Anthropic from "@anthropic-ai/sdk";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as t from "@/db/schema";
import { askAcrossMeetings, askMeeting, buildLlmContext } from "@/lib/ask";
import type { AskAnswer, Meeting } from "@/types";
import { getMeeting, getMeetings } from "./meetings";
import { rankMeetingsForQuestion } from "./text-search";
import { NotFoundError } from "./workspace";

/**
 * Question answering over the workspace.
 *
 * Retrieval happens in Postgres: full-text search ranks meetings for the
 * question, and only those meetings are loaded. The deterministic engine in
 * lib/ask.ts then scores facts and transcript lines and composes a cited
 * answer. If ANTHROPIC_API_KEY is set, Claude rewrites that answer using only
 * the retrieved context; any failure falls back to the local answer.
 */

const SYSTEM = [
  "You answer questions about recorded business meetings for a meeting-notes product.",
  "Use only the meeting context provided. If the context does not contain the answer, say so briefly.",
  "Answer in two or three plain sentences. No markdown, headings, or bullet points.",
  "Mention owners and due dates when the context includes them.",
].join(" ");

let client: Anthropic | null = null;

async function llmAnswer(local: AskAnswer, meetings: Meeting[]): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY || local.sources.length === 0) return null;
  client ??= new Anthropic();
  try {
    const response = await client.beta.messages.create(
      {
        model: "claude-opus-5",
        max_tokens: 1024,
        output_config: { effort: "low" },
        // Server-side refusal fallback: routes a declined request to a fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages: [{ role: "user", content: `Meeting context:\n${buildLlmContext(local, meetings)}\n\nQuestion: ${local.question}` }],
      },
      { timeout: 15_000 },
    );
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return text || null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`Ask LLM error ${error.status}: ${error.message}`);
    else console.error("Ask LLM error", error);
    return null;
  }
}

export async function ask(question: string, meetingId?: string): Promise<AskAnswer> {
  let scope: Meeting[];
  let local: AskAnswer;
  if (meetingId) {
    const meeting = await getMeeting(meetingId);
    if (!meeting) throw new NotFoundError("Meeting");
    scope = [meeting];
    local = askMeeting(meeting, question);
  } else {
    let ids = await rankMeetingsForQuestion(question, 6);
    if (ids.length === 0) {
      // No lexical hits (e.g. only synonyms matched): let the engine's synonym
      // expansion look across the most recent meetings instead.
      const recent = await getDb()
        .select({ id: t.meetings.id })
        .from(t.meetings)
        .where(eq(t.meetings.status, "ready"))
        .orderBy(desc(t.meetings.startsAt))
        .limit(20);
      ids = recent.map((r) => r.id);
    }
    scope = await getMeetings(ids);
    local = askAcrossMeetings(scope, question);
  }
  const llm = await llmAnswer(local, scope);
  return llm ? { ...local, answer: llm, mode: "llm" } : local;
}
