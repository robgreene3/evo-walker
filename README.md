# EvoWalker

EvoWalker is a local-first browser laboratory for deterministic evolutionary locomotion.
It evolves sixteen periodic-controller genes against one fixed four-joint biped, evaluates
each population in a Web Worker, and renders only the current champion in Three.js.

The controller-first MVP supports the full experiment journey: configure a seed, start,
observe generation statistics, pause, resume, cancel, restart, change replay speed, orbit the
camera, inspect component fitness, genome, and ancestry, then save locally or export/import a
validated versioned JSON document.

The original build brief remains unchanged in `01-RESEARCH-AND-VIABILITY.md`,
`02-AGENTS.md`, and `03-GPT-5.6-CODEX-MASTER-PROMPT.md`. `AGENTS.md` is the active repository
instruction file. The package-era README is preserved at `docs/brief/PACKAGE-README.md`.

## Requirements

- Node.js 20.19 or newer; verification uses Node 24.14.0.
- pnpm 11.9.0, selected through the `packageManager` field.
- A current Chromium-family browser with Web Workers, WebAssembly, WebGL 2, and ES modules.

The shell-default Node 20.11.1 observed during repository creation is not supported by the
pinned Vite 8 and ESLint 10 toolchain.

## Run

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The useful default is seed 42, population 12, and 30
breeding generations.

## Verify

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm benchmark
pnpm build
pnpm test:e2e
pnpm verify
```

Install the pinned Playwright browser once with `pnpm exec playwright install chromium` when
it is not already cached. Exact observed evidence and environment caveats are recorded in
`docs/verification.md`.

## Architecture

- `packages/core`: Mulberry32 PRNG, bounded periodic genome, deterministic GA, lineage,
  diversity telemetry, and strict experiment serialization.
- `packages/sim`: deterministic Rapier world, fixed biped, fixed episode, component fitness,
  immutable replay frames, reset, and checksum.
- `packages/worker`: versioned batch/evolution protocol, generation-boundary progress,
  pause/resume/cancellation, error propagation, and Node/browser entries.
- `apps/web`: accessible React controls, champion-only Three.js replay, metrics/history,
  lineage inspection, local persistence, and JSON import/export.
- `docs`: decisions, research provenance, schema, reproducibility, recovery, and evidence.

The worker advances one complete generation synchronously, then yields so the browser can
process pause or cancellation. Rendering consumes copied episode frames and never mutates
authoritative simulation state.

## Experiment integrity

- Experiment-affecting code never calls `Math.random()`.
- Physics uses a fixed 1/120-second step and the deterministic Rapier 0.19.3 compat build.
- Fitness is componentized as progress plus upright bonus minus fall, actuation, lateral,
  and invalid penalties.
- Version-1 experiment JSON is size-bounded and strictly validated before replacing UI state.
- Imported or locally loaded snapshots are inspectable and restartable. Mid-evolution resume
  is intentionally not claimed by version 1.

See `docs/experiment-format.md` and `docs/reproducibility.md` for exact guarantees and limits.

## Scope boundary

Morphology evolution, neural controllers, services, accounts, cloud sync, and telemetry are
not part of this MVP. The controller-first release evidence is closed in
`docs/verification.md`; any morphology work is a separate phase requiring explicit authorization
and preservation of the canonical controller benchmark.
