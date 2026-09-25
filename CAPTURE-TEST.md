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

## Resubmission session (2026-09-25)

The resubmission (own interface + Postgres backend) was built in session `6da68331`, logged at `.agent-logs/2026-09-25_12-37-22_6da68331-a7c8-445e-a1dd-fe8193ef17c8.md`.

- The session started in the desktop app without a project folder and moved into this repository after the first prompt, so the project's `.claude/settings.json` hooks were not active for the opening turns. To avoid gaps, I ran `scripts/agent-log.mjs` on the session's own transcript **before every code commit**. Each commit (`2a19e90` database, `3a2a9c0` API, `788c308` interface, and the ones after) includes the log as it stood at that moment, interleaved with the code.
- One change to the script: the desktop app prepends `<system-reminder>` blocks (for example, the list of recent local folders) to some prompts. The user didn't type these, so the script now removes them. The user's own text is still copied verbatim.

## Canary entries

<!-- CANARY-1 -->
_Pending: to be filled with the raw entries from the canary prompts._
<!-- /CANARY-1 -->
