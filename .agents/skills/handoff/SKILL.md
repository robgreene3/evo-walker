---
name: handoff
description: End-of-session handoff. Use when finishing a work session, before opening a PR, or when asked to "hand off", "wrap up", or "write the handoff".
---
# Handoff

1. Run the verification oracle named in `AGENTS.md`; capture the tail of its output.
2. Rewrite `HANDOFF.md` with exactly these sections: **State** (what works), **Broken** (what does not, with the failing command), **Next** (the single next step), **Oracle** (the captured output tail), **Agent** (name/model, date).
3. Append one dated line to `PROGRESS.md` summarising the session.
4. If an architecture decision was made, append `- YYYY-MM-DD: <decision> — <one-line reason>` to `DECISIONS.md`.
5. Commit on the current branch with message `handoff: <one line>`.
