# EvoWalker

EvoWalker is a local-first browser laboratory for reproducible evolutionary locomotion. A
fixed articulated quadruped runs deterministic physics trials while a continuous quality-diversity
search evolves only its eight-joint periodic controller. Choose six simulated seconds for rapid
search or thirty seconds to select for sustained endurance. Viable gaits occupy an inspectable
archive; fallen or invalid candidates never become champions.

Four deterministic proving grounds are available: the verified flat baseline, a gentle seeded
rise, two low curbs, and a shallow uneven trail. Terrain changes the physical selection pressure
without changing body topology, controller representation, or fitness weights. The live replay
renders the same generated colliders used by the simulation and reports crossed features.

The live experience does not end at an arbitrary generation count. Start a seeded archive,
watch viable gait niches appear, pause or stop at a complete evaluation boundary, replay the
current champion without renderer resets, or select any occupied archive niche to meet that
specimen while evolution continues. Fitness, genome, and ancestry follow the displayed gait;
save or export retains the authoritative live archive plus PRNG state for deterministic
continuation.

The original build brief remains unchanged in `01-RESEARCH-AND-VIABILITY.md`,
`02-AGENTS.md`, and `03-GPT-5.6-CODEX-MASTER-PROMPT.md`. `AGENTS.md` is the active repository
instruction file. The package-era README is preserved at `docs/brief/PACKAGE-README.md`.

## Requirements

- Node.js 20.19 or newer; verification uses Node 24.14.0.
- pnpm 11.9.0, selected through the `packageManager` field.
- A current Chromium-, Firefox-, or WebKit/Safari-family browser with Web Workers, WebAssembly,
  WebGL 2, and ES modules.

The shell-default Node 20.11.1 observed during repository creation is not supported by the
pinned Vite 8 and ESLint 10 toolchain.

## Run

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The verified default uses seed 42, 24 founders, and an 8×8
archive and six-second quick trials. Select “30 seconds · endurance” before starting to test
sustained locomotion; evaluations take roughly five times more computation.

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

Install the pinned Playwright browsers once with
`pnpm exec playwright install chromium firefox webkit` when they are not cached. Exact observed
evidence and environment caveats are in
`docs/verification.md`.

## Architecture

- `packages/core`: Mulberry32 PRNG, bounded periodic genomes, legacy generational GA,
  continuous MAP-Elites-style archive, lineage, deterministic checkpoints, and strict schemas.
- `packages/sim`: deterministic Rapier world, fixed quadruped, episode scoring, gait
  descriptors, immutable replay frames, reset, and checksum.
- `packages/worker`: versioned direct/evolution/exploration/replay protocol with
  evaluation-boundary pause, resume, stop, and browser/Node entries.
- `apps/web`: accessible React controls, uninterrupted Three.js champion replay, a
  keyboard-operable gait atlas with isolated specimen replay, metrics/history, lineage
  inspection, and local/JSON persistence.

Simulation truth stays in the deterministic core and worker. Rendering consumes copied frames
and never mutates experiment state.

## Experiment integrity

- Experiment-affecting code never calls `Math.random()`.
- Physics uses a fixed 1/120-second step and deterministic Rapier 0.19.3 compat build.
- Fitness is progress plus upright bonus minus fall, actuation, lateral, and invalid penalties.
- Archive admission additionally requires a complete viable trial; a fallen sprinter cannot win.
- Gait niches use ground-contact duty factor and diagonal coordination, both clamped to `[0,1]`.
- Schema-v4 JSON is size-bounded and validated before state replacement. It stores the archive,
  episode duration, terrain kind/seed/generator version, bounded lineage/history, configuration,
  and exact PRNG state needed to continue. Valid schema-v2 and schema-v3 experiments migrate
  explicitly to six-second trials.
- Same-runtime checkpoint continuation is tested exactly. Cross-platform bitwise equality is not
  claimed.

See `docs/experiment-format.md`, `docs/reproducibility.md`, and `docs/recovery.md`.

## Scope boundary

The creature topology remains fixed. Morphology evolution, neural controllers, ecology,
resources, accounts, cloud sync, telemetry, and backend services are not part of this build.
“Gait ecology” describes a controller-behavior archive, not a claim of open-ended biological
evolution.

## Licence

EvoWalker is available under the MIT License. See `LICENSE`.
