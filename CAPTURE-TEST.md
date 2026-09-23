# Capture Test

## Tool and model

- **Tool:** Claude Code (Claude desktop app, Code tab), on Windows 10
- **Model:** `claude-opus-5-5` for every turn, for both planning and execution (single model, no subagents). The model name is recorded on every log entry.
- **Automatic mechanism available:** yes. Claude Code supports lifecycle hooks (`UserPromptSubmit`, `Stop`) configured in `.claude/settings.json`, and it writes a native per-session transcript (JSONL) to `~/.claude/projects/<project>/<session-id>.jsonl`.

## Mechanism

- **Config file changed:** `.claude/settings.json` (committed). `UserPromptSubmit` and `Stop` both run:
  ```
  node "$CLAUDE_PROJECT_DIR/scripts/agent-log.mjs"
  ```
- **Script:** `scripts/agent-log.mjs` reads the hook payload (`session_id`, `transcript_path`) from stdin and regenerates that session's log file from Claude Code's own transcript. For each turn it writes the user's prompt verbatim and the final response of the turn (the text after the turn's last tool call), with UTC timestamps and the model name. Thinking, tool calls, and intermediate steps are excluded. Entries are copied as-is; nothing is edited or summarised.
- **Log location:** `.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md`, one file per session, in the 8x format.

## What happened first (read this)

**The capture hook was not installed before the build started.** I did not run the 8x capture setup at the start of the assignment, so no hook fired while the app was being built (2026-09-23, 03:08–04:04 UTC).

Claude Code nonetheless keeps a complete native transcript of every session. After the submission was returned for missing logs, I:

1. Wrote `scripts/agent-log.mjs` and ran it on the build session's own transcript (`7c0db722-2666-4a62-86ba-098daed66c83.jsonl`). That produced `.agent-logs/2026-09-23_03-08-33_7c0db722-2666-4a62-86ba-098daed66c83.md`. It contains the real prompts and final responses with their original timestamps, unedited, including the later non-build turns (running the app, the walkthrough script, and this fix).
2. Installed the same script as `UserPromptSubmit` and `Stop` hooks, so every session from now on is captured automatically.

Consequences I'm not hiding:

- The build-session log was **generated after the fact** from the native transcript, not appended live by a hook.
- The logs were **not committed interleaved with the code**. The code commits (`3c40fa2`, `c777bbe`, `decca08`) were made during the build; the log was committed afterwards. I have not rewritten git history or backdated anything.

### Pipe test of the hook (passed)

Running the hook command with a real `Stop` payload regenerated the session file: 11 prompts and 10 responses. The 11th prompt, the one that asked for this fix, was still in progress at the time.

## Canary entries

<!-- CANARY-1 -->
_Pending: to be filled with the raw entries from the canary prompts._
<!-- /CANARY-1 -->
