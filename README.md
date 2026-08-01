# EvoWalker

EvoWalker is becoming a browser-based evolutionary locomotion sandbox inspired by the
breve Walker demo. The current verified vertical slice is deliberately smaller than the
full MVP: it runs one fixed-topology, four-joint Rapier creature from a seeded periodic
controller, evolves those 16 controller scalars with a deterministic population-based GA,
records component fitness and replay frames, and proves reset/replay and repeated-evolution
equivalence in the supported runtime.

The original build brief remains unchanged in `01-RESEARCH-AND-VIABILITY.md`,
`02-AGENTS.md`, and `03-GPT-5.6-CODEX-MASTER-PROMPT.md`. `AGENTS.md` is the active
repository instruction file. The package-era README is preserved at
`docs/brief/PACKAGE-README.md`.

## Requirements

- Node.js 20.19 or newer; verification currently uses Node 24.14.0.
- pnpm 11.9.0, selected through the `packageManager` field.

The shell-default Node 20.11.1 observed during repository creation is not supported by
the pinned Vite 8 and ESLint 10 toolchain.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm benchmark
pnpm build
pnpm verify
```

`pnpm dev` prints one canonical episode and confirms that replay ends with the same
physics-world checksum. It is a simulation harness, not the future browser UI.

## Current boundaries

- `packages/core`: seeded PRNG, bounded controller genome, and deterministic GA operators.
- `packages/sim`: deterministic Rapier world, articulated creature, fixed episode,
  component fitness, snapshots, reset, and replay.
- `packages/worker`: versioned batch protocol, off-thread evaluation entry points, progress,
  cancellation, and error propagation.
- `docs`: decisions, research provenance, reproducibility policy, and observed evidence.

The React/Three.js UI, persistence, and release gate remain later ordered slices. Morphology
evolution, neural controllers, services, accounts, and telemetry remain out of scope.
