# Reproducibility policy

## Supported episode baseline

- macOS 26.5.2, arm64
- Node.js 24.14.0
- pnpm 11.9.0
- `@dimforge/rapier3d-deterministic-compat` 0.19.3
- fixed timestep: 1/120 second
- substeps: 1
- solver iterations: 8; internal PGS iterations: 2
- settling interval: 1 second
- scored duration: 2 seconds; total episode duration: 3 seconds

## Predeclared Slice 2 gate

For an unchanged build in the supported environment, two fresh runs and a reset/replay
must:

1. terminate at exactly 360 steps;
2. produce no NaN or Infinity;
3. report identical invalid reasons and component names;
4. keep each component and aggregate fitness within absolute tolerance `1e-9`;
5. produce the same final Rapier world-snapshot checksum;
6. reproduce every captured body transform within absolute tolerance `1e-9`.

The automated same-runtime gate currently uses exact equality, which is stricter than
the numeric tolerance. Cross-browser and cross-platform claims remain unknown until
those environments are exercised. `Math.sin()` is used to evaluate controller targets;
Rapier's documentation warns that transcendental functions can differ across platforms,
so no bitwise cross-platform controller claim is made.

The Slice 3 GA uses the same Mulberry32 stream for initialization, tournament selection,
arithmetic crossover, and bounded Gaussian mutation. The benchmark repeats one complete
30-generation run exactly and checks improvement across seeds 7, 42, and 99.

The incremental worker session consumes the same random draws in the same order as the direct
GA wrapper. The canonical seed-42 browser run reproduced aggregate fitness
`1.8269563074123853` at generation 30. Same-build worker/direct equality is exact; the public
cross-browser numerical policy remains absolute tolerance `1e-9` because `Math.sin()` and host
floating-point behavior have not been exhaustively compared across supported browsers.

Version-1 JSON serialization preserves stored JavaScript numbers and checksums exactly. This is
storage equivalence, not a claim that a future physics or schema version will reproduce the same
world. Binding, engine, build, schema, timestep, substeps, seed, fitness, and checksum remain in
the document so drift is visible.

## Fitness

`fitness = forward progress + upright bonus - fall penalty - actuation energy penalty - lateral drift penalty - invalid penalty`

Forward progress uses the mass-weighted centre of mass after settling. The actuation
term is a controller target-motion proxy, not measured electrical or mechanical energy;
the UI must retain that label when it is introduced.
