# Decision 0001: controller-first deterministic workspace

- Status: accepted
- Date: 2026-08-01
- Scope: repository baseline and single-creature episode

## Context

The input was a four-file brief package, not a repository. The master prompt requires
ordered vertical slices and specifically forbids broad-scaffolding the browser UI before
the deterministic simulation boundary is proven.

## Decision

- Use a strict pnpm TypeScript workspace with `packages/core` and `packages/sim` as the
  only implementation packages in this slice.
- Use Mulberry32 (`mulberry32-v1`) as the single explicit seeded PRNG. No experiment path
  may call `Math.random()`.
- Use `@dimforge/rapier3d-deterministic-compat` 0.19.3. The deterministic flavor supports
  the experiment integrity requirement; the compat flavor embeds WASM and is the
  official wider-bundler-support option.
- Use a four-limb fixed morphology with one bounded revolute hip motor per limb.
- Use a periodic controller with amplitude, frequency, phase, and offset per joint.
- Measure mass-weighted creature centre-of-mass progress after a settling interval.
- Report progress, upright bonus, fall penalty, lateral drift penalty, invalid penalty,
  and an explicitly labelled controller-motion energy proxy.
- Claim exact repetition only for the observed supported build/runtime. Retain a
  tolerance-based public policy until browser/platform evidence exists.

## Rejected for this slice

- Ordinary `@dimforge/rapier3d`: its official bindings no longer guarantee
  cross-platform deterministic execution.
- React, Three.js, Web Workers, persistence, GA scaffolding, neural controllers, and
  morphology genes: each belongs to a later acceptance-gated slice.
- TypeScript 7.0.2: current `typescript-eslint` 8.65.0 declares TypeScript `<6.1`, so the
  workspace pins TypeScript 6.0.3.

## Consequences

The current command-line harness is scientifically inspectable and cheap to disprove,
but it is not yet the user-facing browser product. The compat WASM package is larger
than the non-compat package; browser bundle impact must be measured during the UI slice.
