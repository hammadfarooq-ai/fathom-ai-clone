import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { findMeeting, seededMeetings } from "@/data";
import { askAcrossMeetings, askMeeting, buildLlmContext } from "@/lib/ask";
import type { AskAnswer, Meeting } from "@/types";

/**
 * POST /api/ask  { question, meetingId?, includeIds? }
 *
 * Always computes a deterministic, retrieval-based answer over the meeting data.
 * If ANTHROPIC_API_KEY is configured, Claude rewrites that answer using only the
 * retrieved context; any failure falls back to the local answer, so the feature
 * works with no configuration at all.
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
        messages: [
          {
            role: "user",
            content: `Meeting context:\n${buildLlmContext(local, meetings)}\n\nQuestion: ${local.question}`,
          },
        ],
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

export async function POST(request: Request) {
  let body: { question?: unknown; meetingId?: unknown; includeIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) return NextResponse.json({ error: "A question is required" }, { status: 400 });

  let scope: Meeting[];
  let local: AskAnswer;
  if (typeof body.meetingId === "string") {
    const meeting = findMeeting(body.meetingId);
    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    scope = [meeting];
    local = askMeeting(meeting, question);
  } else {
    const extra = Array.isArray(body.includeIds)
      ? body.includeIds.filter((id): id is string => typeof id === "string").map(findMeeting).filter((m): m is Meeting => Boolean(m))
      : [];
    scope = [...extra, ...seededMeetings];
    local = askAcrossMeetings(scope, question);
  }

  const llm = await llmAnswer(local, scope);
  return NextResponse.json(llm ? { ...local, answer: llm, mode: "llm" } : local);
}
