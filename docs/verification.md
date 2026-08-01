# Verification evidence ledger

## Cycle 1: repository and toolchain baseline

- User-visible slice: turn the brief package into an executable, testable workspace.
- Baseline: four regular files, no `.git`, no package manifest, no source, no tests.
- Predicted result: a clean pinned install and strict basic toolchain can run without
  changing the brief artifacts.
- Guardrails: keep all original brief content; no UI/GA/worker/persistence scaffolding;
  no deferred features.
- Falsifier: brief hash drift, incompatible pinned peers, or any basic check that cannot
  be reproduced on the declared runtime.
- Decision: **KEEP**. Workspace and lockfile were created; full results are recorded
  below.

Original artifact SHA-256 values:

```text
dbcb10588762d9c68c4402b48b255b6a555a5e5e9381202d1738d03b68ebf9d2  01-RESEARCH-AND-VIABILITY.md
49405fd23fa41a64b809d0e8b3233729662a8c66d80db5bd394429616005987b  02-AGENTS.md
ff6c1c49d744b545b557b49a6f84828ae7283263425d4021140a3363d4649a59  03-GPT-5.6-CODEX-MASTER-PROMPT.md
973a1effbfa0ed05fe2cabfb43570abc8c3fe7baf6d567cda82ca3043797a779  original package README (preserved at docs/brief/PACKAGE-README.md)
```

Environment inventory:

```text
macOS 26.5.2 (25F84), Darwin arm64
shell-default Node 20.11.1 (unsupported by selected Vite/ESLint)
verification Node 24.14.0
pnpm 11.9.0
git 2.39.3
```

## Cycle 2: deterministic single-creature episode

- Testable hypothesis: a four-joint creature driven by explicit periodic genes can run
  for 360 fixed steps, produce finite component fitness, and replay without world-state
  leakage.
- Predicted result: same controller/config produces metrics within `1e-9` and the exact
  same final world checksum in the supported runtime.
- Guardrails: fixed topology; centre-of-mass scoring; controller energy labelled as a
  proxy; no `Math.random()`; no GA, UI, workers, neural network, or morphology evolution.
- Falsifier: non-finite state, variable termination, metric drift above tolerance,
  checksum mismatch, or reset/replay inequality.
- Initial failure: the first integration test reached Rapier before its WASM module was
  initialized and failed at `rawintegrationparameters_new`. Added the documented one-time
  asynchronous `RAPIER.init()` before world construction.
- Decision: **KEEP** after revision. Ten targeted tests passed; canonical seed evidence
  and complete command output follow below.

## Observed commands and results

This section is updated only from actual command output. The bundled Node path was used
because the login shell resolves an unsupported Node 20.11.1.

```text
pnpm install
  PASS: 142 packages installed; lockfile created; lifecycle scripts remained blocked.

node node_modules/typescript/bin/tsc -p tsconfig.json --pretty false
  PASS: no diagnostics.

node node_modules/vitest/vitest.mjs run packages/core packages/sim --exclude packages/**/*.benchmark.test.ts
  PASS: 3 files, 10 tests.

node node_modules/vitest/vitest.mjs run --config vitest.benchmark.config.ts
  PASS: 1 file, 1 canonical-seed reproducibility test.
```

Original Slice 2 outcomes (each was executed twice and matched exactly; superseded by the
accepted two-hip/two-knee phenotype below):

| Seed |   Aggregate fitness | Final world checksum |
| ---: | ------------------: | -------------------- |
|    7 | 0.15475810945521457 | `0b514dbc`           |
|   42 | 0.14977146694650856 | `319a03a0`           |
|   99 | 0.16645198962701704 | `6e9ca5dd`           |
| 2026 | 0.18303492722643497 | `8691081c`           |
| 7311 | 0.17660505196077403 | `479b3045`           |

Ten complete paired episodes took 385.6 ms in one observed run. This is diagnostic
metadata, not yet a performance gate.

Additional observed checks:

```text
isolated pnpm install --frozen-lockfile
  PASS: 142 packages linked in /private/tmp/evowalker-clean-install.UfWCQi;
        lockfile supply-chain policy passed for 190 entries.

isolated typecheck and unit/integration tests
  PASS: no type diagnostics; 3 files, 10 tests.

node node_modules/prettier/bin/prettier.cjs --check .
  PASS.

node node_modules/eslint/bin/eslint.js .
  PASS.

node node_modules/typescript/bin/tsc -b tsconfig.build.json --pretty false --force
  PASS; core and sim JS, declarations, and source maps emitted.

node packages/sim/dist/demo.js
  PASS: seed 7311 fitness 0.17660505196077403; first/replay checksum 479b3045;
        no invalid reason.

pnpm audit --audit-level high
  PASS: no known vulnerabilities found.

pnpm licenses list --prod / --dev
  PASS: production dependency Apache-2.0; development graph limited to
        Apache-2.0, BlueOak-1.0.0, BSD-2-Clause, BSD-3-Clause, ISC, MIT, and MPL-2.0.
```

## Known verification limitations

- Rapier's 0.19.3 compat initializer emits an upstream deprecation warning despite its
  declared public `init(): Promise<void>` signature. Results remain valid; recheck on a
  future Rapier release and do not suppress the warning silently.
- pnpm blocked the `esbuild@0.28.1` lifecycle script. The current TypeScript build and
  Vitest suite pass without approving it. Reassess only if the later browser bundle
  demonstrably requires that script.
- No browser, worker, UI, accessibility, or persistence claim has been tested; those belong
  to later ordered slices.

## Reverted Cycle 3 experiment: GA readiness

- Hypothesis: the Slice 2 morphology exposes enough controllable locomotion for a small
  seeded GA to improve forward motion over 30 generations.
- Predeclared revision gate: best aggregate improvement at least `0.02` and champion raw
  forward distance at least `0.002` metres for seeds 7, 42, and 99.
- First observation: a deterministic GA improved aggregate fitness to about `0.198` by
  minimizing actuation while remaining upright. This was a standing-still reward exploit,
  not locomotion, so the result was rejected.
- Bounded revisions: made raw forward distance dominant, added explicit feet, and tested
  a longer episode without changing the gate after observing results.
- Falsifying result: best aggregate improvement remained about `0.009`–`0.016`; champion
  forward distance remained about `0.0011`–`0.0014` metres.
- Decision: **REVERT**. The experimental GA, feet, fitness retuning, and longer episode
  were removed. Slices 1–2 remain the verified baseline. Before Slice 3 resumes, the next
  discriminating test must demonstrate that a fixed four-actuator phenotype can generate
  materially distinct forward displacements without relying on an upright/energy exploit.

## Cycle 3a: fixed-phenotype locomotion gate

- Testable hypothesis: replacing the ineffective four independent straight limbs with a
  fixed biped containing two actuated hips and two actuated knees exposes enough control
  authority for periodic controllers to produce materially different forward movement.
- Predicted result: a deterministic probe of 64 coordinated periodic controllers completes
  without invalid physics state, contains at least one controller with forward progress of
  `0.02` metres or more, and spans at least `0.04` metres from minimum to maximum forward
  progress.
- Guardrails: exactly four actuators; fixed morphology; unchanged three-second episode and
  component fitness; explicit Mulberry32 sampling; no GA, selection, mutation, worker, UI,
  persistence, or morphology evolution.
- Falsifier: any invalid run, maximum forward progress below `0.02` metres, or displacement
  range below `0.04` metres.
- Initial observation: the literal displacement thresholds passed, with progress from
  `1.425172578378875` to `1.5412213090604128` metres, but the apparent champion's torso
  fell to `0.24216365814208984` metres and aggregate fitness was negative. This was a
  gravitational-tumbling false positive, not accepted locomotion.
- Predeclared revision: retain the original displacement thresholds and require that the
  qualifying envelope and champion contain only runs with zero fall penalty.
- Revised-gate observation: zero of 64 initially sampled gaits avoided the fall penalty.
- Bounded stability revision: keep the four-actuator biped but restrict its 3D rigid bodies
  to sagittal-plane motion, center and lengthen its feet, and extend the deterministic probe
  into the low-amplitude part of the already declared controller bounds. Episode duration,
  scoring, controller dimensions, and the revised stable-displacement gate stay unchanged.
- Revision observation: both the 64-controller probe and an isolated single episode exceeded
  their normal 30-second test budget after the planar restriction was added.
- Decision: **REVERT IN PART**. The overconstrained sagittal-body restriction was removed;
  the centered feet and wider probe coverage remain candidates. Connected-body contact was
  correctly disabled so the joints can actuate; stable controlled locomotion remains
  unproven.
- Passive-control observation: an exact zero-amplitude controller also incurred the fall
  penalty, isolating insufficient joint support rather than gait selection as the current
  failure.
- Predeclared support revision: increase the existing Rapier joint PD gains from stiffness
  and damping `38`/`4.5` to `320`/`24`; keep all controller targets and gate thresholds
  unchanged.
- Support-gain observation: 5 of 64 controllers avoided the fall penalty and stable COM
  progress ranged from `0.4335010888819546` to `0.6188622435184598` metres. However, the
  apparent champion's lower-leg assemblies moved no farther than about `0.014` metres while
  its torso reached forward, exposing another false positive rather than a step.
- Predeclared gait revision: retain every existing criterion and additionally require that
  at least one lower-leg/foot assembly in the qualifying champion finishes at least `0.02`
  metres ahead of its position after settling.
- Foot-gate observation: the best stable controller advanced a lower-leg assembly only
  `0.013364952057600021` metres. More importantly, the passive zero-amplitude control was
  credited `0.43440683457373236` metres of COM progress while its feet stayed fixed, proving
  that the score reference was captured before static support reached equilibrium.
- Predeclared settling revision: increase only the unscored settling interval from `0.5` to
  `1.0` seconds within the unchanged three-second episode, and require passive-control
  progress magnitude no greater than `0.005` metres in addition to every prior gate.
- Settling observation: passive progress remained `0.4335892881184869` metres, so the body
  was continuously yielding under gravity rather than merely reaching equilibrium late.
- Predeclared support revision: retain the passive guardrail and increase joint PD stiffness
  and damping one order of magnitude from `320`/`24` to `3200`/`80` without changing targets,
  scoring, or acceptance criteria.
- Final observation: passive drift fell to `-0.000008612688556988192` metres; 31 of 64
  controllers avoided the fall penalty; stable progress ranged from
  `-0.000008612688556988192` to `1.378237647636359` metres; and the champion's lower-leg/foot
  assembly advanced `0.5731841400265694` metres. Replaying the champion reproduced checksum
  `73f723bf` exactly.
- Decision: **KEEP**. The fixed two-hip/two-knee phenotype passes the stable locomotion gate.
  Slice 3 may now resume with controller genes only.

## Cycle 3b: deterministic controller evolution

- Testable hypothesis: a small seeded GA operating only on the 16 periodic-controller
  scalars can improve the corrected fixed biped over 30 breeding generations.
- Predicted result: population 12 with 2 elites, tournament size 3, arithmetic crossover,
  and bounded Gaussian mutation improves best aggregate fitness by at least `0.02` for seeds
  7, 42, and 99; every champion remains upright, is valid, and moves forward at least `0.02`
  metres; repeating seed 7 reproduces the complete evolution result exactly.
- Guardrails: fixed morphology and fitness; one explicit Mulberry32 stream; no
  `Math.random()`; no worker, UI, persistence, neural network, morphology genes, or changed
  benchmark threshold after observation.
- Falsifier: insufficient improvement for any seed, fall/invalid champion, raw progress
  below threshold, operator invariant failure, or repeated-seed mismatch.
- Initial failure: arithmetic crossover could round a bounded parent value infinitesimally
  beyond an inclusive gene bound, and the no-mutation branch returned it without clamping.
  The 30-generation benchmark stopped at controller validation before testing improvement.
- Bounded revision: normalize every scalar at the mutation boundary whether or not mutation
  fires; keep the configuration and all benchmark thresholds unchanged.
- Final observation: all three seeds passed. Seed 7 improved from `0.9016690903606972` to
  `1.8252031594739515` (delta `0.9235340691132543`, progress `1.713166620580992`, checksum
  `6c08333d`); seed 42 improved from `1.410540109386513` to `1.8269563074123853` (delta
  `0.41641619802587226`, progress `1.6986537617407735`, checksum `9db38d7c`); seed 99
  improved from `1.3034456720767262` to `1.960891284526517` (delta
  `0.6574456124497907`, progress `1.8669263917743382`, checksum `aad3d8ee`). All champions
  were upright and valid. Repeating the complete seed-7 evolution matched exactly.
- Observed runtime: four complete GA runs, including the repeated seed, took
  `30007.239291` ms on the verification machine. This is evidence, not yet a browser
  performance gate.
- Decision: **KEEP AS FOUNDATION**. The operator and improvement gates pass. Slice 3 remains
  open until lineage and diversity telemetry required by the master prompt are implemented.

Accepted post-Slice-3 canonical single-episode outcomes (each executed twice exactly):

| Seed |   Aggregate fitness | Final world checksum |
| ---: | ------------------: | -------------------- |
|    7 | -0.8951691727472024 | `c4a6ddde`           |
|   42 | -0.7027636241210745 | `c561ebbf`           |
|   99 | -0.6935843248964375 | `4e01e12b`           |
| 2026 | -1.5993009176178334 | `5c0edf81`           |
| 7311 |  -0.655646880559507 | `a73886ca`           |

## Cycle 4: worker evaluation boundary

- Testable hypothesis: the same typed genome batch evaluated in a separate worker thread
  produces exactly the direct result while reporting monotonic progress, and cancellation
  stops at a complete-episode boundary before cleanup.
- Predicted result: five direct and worker evaluations match exactly including components
  and checksums; progress reports `[1,2,3,4,5]`; a second eight-genome batch cancelled after
  progress 2 returns `cancelled` with exactly 2 completed evaluations; the worker terminates.
- Guardrails: protocol version 1; batches limited to 1–1000 validated genomes; no UI,
  persistence, pool optimization, morphology change, or relaxed numeric tolerance.
- Falsifier: result drift, out-of-order/missing progress, cancellation after additional
  episodes, uncaught worker error, or thread cleanup failure.
- Initial failure: direct and worker values matched, but the worker began and completed a
  third episode before servicing the cancellation message sent after progress 2.
- Bounded revision: yield through a timer turn rather than `setImmediate` between episodes,
  giving inbound cancellation a defined event-loop opportunity; keep the exact-two gate.
- Final observation: all five worker evaluations matched direct values, components, invalid
  reasons, and checksums exactly; progress was `[1,2,3,4,5]`; the second batch returned
  `cancelled` after exactly two episodes with progress `[1,2]`; both worker threads were
  terminated in `finally` cleanup.
- Decision: **KEEP AS FOUNDATION**. The portable protocol, browser entry, and observed Node
  worker-thread boundary pass their equivalence gate. Slice 4 closes only after browser UI
  responsiveness and cancellation are observed during Slice 5 integration.

## Current full-workspace verification

The first `pnpm verify` attempt from the login environment reached Vitest under the
unsupported shell-default Node 20.11.1 and failed because that runtime does not export
`node:util.styleText`. Repeating the same package script with child commands explicitly
resolved through the declared verification Node 24.14.0 produced:

```text
format: PASS; all matched files use Prettier style
lint: PASS; no ESLint diagnostics
typecheck: PASS; no strict TypeScript diagnostics
tests: PASS; 4 source files, 12 tests
benchmarks: PASS; 4 files, 4 tests
build: PASS; core, sim, and worker composite TypeScript build
```

The built seed-7311 episode then reproduced checksum `a73886ca` on replay, returned no
invalid reason, and reported all component fitness values. A recursive source scan found no
`Math.random()` calls under `packages/`. The four protected brief hashes still match the
Cycle 1 values exactly. The Rapier initializer warning documented above remains visible.
