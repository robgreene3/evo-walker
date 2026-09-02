# Handoff
## State
Last commit 2026-08-09 "docs: record hosted release verification". Contract adopted on branch `agent-contract`; existing `AGENTS.md` kept with a contract section appended; `CLAUDE.md` imports it.
## Broken
Oracle failed on 2026-09-02; see Oracle section.
## Next
Merge `agent-contract`; run `pnpm verify`; fill PLAN.md from docs/.
## Oracle
`pnpm verify` — FAIL (2026-09-02)
```
         93.6%
######################################################################################################################################################################################## 100.0%
Computing checksum with sha256sum
Checksums matched!
Now using node v24.20.0 (npm v11.19.0)
! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-11.9.0.tgz
? Do you want to continue? [Y/n] 
Scope: all 5 workspace projects
✓ Lockfile passes supply-chain policies (verified 29d ago)
Lockfile is up to date, resolution step is skipped
Already up to date

Done in 705ms using pnpm v11.9.0

   ╭───────────────────────────────────────────────╮
   │                                               │
   │      Update available! 11.9.0 → 11.25.0.      │
   │     Changelog: https://pnpm.io/v/11.25.0      │
   │   To update, run: corepack use pnpm@11.25.0   │
   │                                               │
   ╰───────────────────────────────────────────────╯

$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm benchmark && pnpm --filter @evowalker/web build && pnpm test:e2e
$ prettier --check .
Checking formatting...
[warn] .agents/skills/handoff/SKILL.md
[warn] .github/PULL_REQUEST_TEMPLATE.md
[warn] CLAUDE.md
[warn] DECISIONS.md
[warn] HANDOFF.md
[warn] PLAN.md
[warn] PROGRESS.md
[warn] Code style issues found in 7 files. Run Prettier with --write to fix.
[ELIFECYCLE] Command failed with exit code 1.
[ELIFECYCLE] Command failed with exit code 1.
```
## Agent
claude-cowork/fable-5.1, 2026-09-02
