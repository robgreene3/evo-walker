# Handoff

## State

Last commit 2026-08-09 "docs: record hosted release verification". Contract adopted on branch `agent-contract`; existing `AGENTS.md` kept with a contract section appended; `CLAUDE.md` imports it.

## Broken

Nothing known.

## Next

Merge `agent-contract`; run `pnpm verify`; fill PLAN.md from docs/.

## Oracle

`pnpm verify` — PASS (2026-09-02)

```
TwQwth5.js                2,361.44 kB
dist/assets/index-CD7Kl-fc.css                11.29 kB │ gzip:   3.23 kB
dist/assets/index-YUTkRAo2.js                803.07 kB │ gzip: 215.50 kB │ map: 4,015.07 kB

✓ built in 604ms
[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
$ playwright test
[WebServer] $ vite build

[WebServer] [plugin builtin:vite-reporter]
[WebServer] (!) Some chunks are larger than 500 kB after minification. Consider:
[WebServer] - Using dynamic import() to code-split the application
[WebServer] - Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
[WebServer] - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

[WebServer] $ vite preview --host 127.0.0.1


Running 3 tests using 1 worker

[1/3] [chromium] › apps/web/e2e/critical-journey.spec.ts:33:1 › completes a short experiment from the keyboard
[2/3] [chromium] › apps/web/e2e/critical-journey.spec.ts:99:1 › pauses, resumes, and cancels at generation boundaries
[3/3] [chromium] › apps/web/e2e/critical-journey.spec.ts:149:1 › preserves essential content on a reduced-motion mobile viewport
  3 passed (14.5s)
```

## Agent

claude-cowork/fable-5.1, 2026-09-02
