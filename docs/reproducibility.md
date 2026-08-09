# Reproducibility policy

## Supported baseline

- macOS 26.5.2 arm64; Node.js 24.14.0; pnpm 11.9.0
- `@dimforge/rapier3d-deterministic-compat` 0.19.3
- fixed timestep 1/120 second; one substep
- 0.75-second unscored settling interval; 5.25-second scored interval; 6-second total
- fixed one-torso/four-two-segment-leg morphology; eight periodic joint controllers

For an unchanged build in the supported runtime, a fresh episode and reset/replay must terminate
at 720 steps, contain no non-finite state, reproduce all components/frames exactly, and produce
the same world checksum. Automated tests use exact equality; the public cross-platform numerical
policy remains absolute tolerance `1e-9` because `Math.sin()` and host floating-point behavior
have not been exhaustively compared across browsers.

## Continuous search

One Mulberry32 stream controls founder seeds, archive parent selection, crossover, bounded
Gaussian mutation, and immigrants. The archive admits only complete viable trials. Its two
behavior coordinates are contact duty factor and diagonal coordination, each in `[0,1]`.

Checkpoint tests compare an uninterrupted 40-step quality-diversity session to one restored after
17 steps and require exact snapshot equality. Worker tests make the same comparison through the
simulation boundary. Schema v2 stores enough state to continue exactly in the supported build.

The canonical improvement benchmark uses seeds 7, 42, and 99, 24 founders, an 8×8 archive, and
128 offspring trials. It requires non-regression for every seed, at least two seeds improving by
`0.1`, mean improvement of at least `0.4`, at least six additional viable niches per run, and a
valid non-falling champion moving at least `0.1` metres.

## Fitness and viability

`fitness = forward progress + upright bonus - fall penalty - actuation proxy - lateral drift penalty - invalid penalty`

Forward progress uses mass-weighted centre of mass after settling. The actuation term is a target
motion proxy, not physical energy. Fitness still explains ranking inside a niche; archive
admission separately requires no persistent fall and no invalid state. This prevents a fast fall
from defeating a slower complete gait.

Stored numbers and checksums round-trip exactly. This is storage equivalence, not a claim that a
future physics, browser, or schema version reproduces the same world.
