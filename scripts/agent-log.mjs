#!/usr/bin/env node
/**
 * Writes a Claude Code session transcript to .agent-logs/ in the 8x capture format:
 * one file per session, each turn = the user's prompt verbatim + the final
 * response of that turn (text after the turn's last tool call), with UTC
 * timestamps and the model name. Thinking, tool calls, and intermediate steps
 * are excluded. Entries are copied verbatim — never edited or summarised.
 *
 * Usage:
 *   - As a Claude Code hook (UserPromptSubmit / Stop): reads the hook JSON on
 *     stdin ({ transcript_path, session_id }) and regenerates that session's file.
 *   - Manually: node scripts/agent-log.mjs <path-to-session.jsonl>
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const outDir = path.join(repoRoot, ".agent-logs");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function author() {
  try {
    const url = execSync("git remote get-url origin", { cwd: repoRoot, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const m = url.match(/github\.com[:/]([^/]+)\//);
    if (m) return m[1];
  } catch {}
  return process.env.USER || process.env.USERNAME || "unknown";
}

function promptText(entry) {
  const c = entry.message?.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c) || c.some((b) => b.type === "tool_result")) return null;
  const text = c.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return text || null;
}

function isHumanPrompt(e) {
  return e.type === "user" && !e.isMeta && !e.isSidechain && promptText(e) !== null;
}

function buildTurns(entries) {
  const turns = [];
  let current = null;
  for (const e of entries) {
    if (isHumanPrompt(e)) {
      current = { prompt: promptText(e), promptTime: e.timestamp, assistant: [] };
      turns.push(current);
    } else if (current && e.type === "assistant" && !e.isSidechain && e.message) {
      current.assistant.push(e);
    }
  }
  return turns.map((t) => {
    // Final response = text blocks after the last tool call of the turn.
    let lastTool = -1;
    t.assistant.forEach((e, i) => {
      if ((e.message.content ?? []).some?.((b) => b.type === "tool_use")) lastTool = i;
    });
    const tail = t.assistant.slice(lastTool + 1);
    const text = tail
      .flatMap((e) => (Array.isArray(e.message.content) ? e.message.content : []))
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n\n")
      .trim();
    const last = tail.at(-1) ?? t.assistant.at(-1);
    return {
      prompt: t.prompt,
      promptTime: t.promptTime,
      promptModel: t.assistant[0]?.message.model ?? last?.message.model ?? "unknown",
      response: text || null,
      responseTime: tail.at(-1)?.timestamp ?? null,
      responseModel: last?.message.model ?? "unknown",
    };
  });
}

function render(sessionId, turns) {
  const short = sessionId.slice(0, 8);
  const first = turns[0].promptTime;
  const lastPrompt = turns.at(-1).promptTime;
  const models = [...new Set(turns.flatMap((t) => [t.promptModel, t.responseModel]).filter((m) => m && m !== "unknown"))];
  const lines = [
    "---",
    `session_id: ${sessionId}`,
    `date: ${first.slice(0, 10)}`,
    `author: ${author()}`,
    `model: ${models.join(", ") || "unknown"}`,
    "tool: claude-code",
    `project: ${path.basename(repoRoot)}`,
    `total_exchanges: ${turns.length}`,
    `first_prompt_time: ${first}`,
    `last_prompt_time: ${lastPrompt}`,
    "---",
    "",
    `# Session Log - ${first.slice(0, 10)}`,
    "",
    `Session: \`${short}\` | Project: \`${path.basename(repoRoot)}\` | Author: \`${author()}\``,
    "",
    "---",
    "",
  ];
  turns.forEach((t, i) => {
    const n = i + 1;
    lines.push(`[LOG_ENTRY type=PROMPT num=${n} session=${short}]`, `timestamp: ${t.promptTime}`, `model: ${t.promptModel}`, "", t.prompt, "", "");
    if (t.response) {
      lines.push(`[LOG_ENTRY type=RESPONSE num=${n} session=${short}]`, `timestamp: ${t.responseTime}`, `model: ${t.responseModel}`, "", t.response, "", "");
    }
  });
  return lines.join("\n");
}

function main() {
  let transcriptPath = process.argv[2];
  let sessionId;
  if (!transcriptPath) {
    const raw = readStdin();
    if (!raw.trim()) return;
    const hook = JSON.parse(raw);
    transcriptPath = hook.transcript_path;
    sessionId = hook.session_id;
  }
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;

  const entries = fs
    .readFileSync(transcriptPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  sessionId ??= entries.find((e) => e.sessionId)?.sessionId ?? path.basename(transcriptPath, ".jsonl");

  const turns = buildTurns(entries);
  if (turns.length === 0) return;

  const stamp = turns[0].promptTime.replace(/\.\d+Z$/, "").replace("T", "_").replace(/:/g, "-");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${stamp}_${sessionId}.md`), render(sessionId, turns));
}

try {
  main();
} catch (err) {
  // Never block the agent because logging failed.
  process.stderr.write(`agent-log: ${err.message}\n`);
}
