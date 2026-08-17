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
- At this Cycle 1 checkpoint, no browser, worker, UI, accessibility, or persistence claim
  had been tested; those claims are verified in the later ordered slices below.

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

## Cycle 3c: lineage and diversity completion

- Testable hypothesis: recording one immutable birth/carryover record per population member
  plus median fitness, duplicate rate, and normalized genotype distance makes evolution
  inspectable without consuming PRNG values or changing selection outcomes.
- Predicted result: lineage contains `populationSize * (generations + 1)` unique records;
  every non-initial parent resolves exactly one generation backward; elite carryovers are
  explicit; telemetry is finite and bounded; repeated evolution remains exact; canonical
  30-generation fitness outcomes remain unchanged.
- Guardrails: no new random draws, operator changes, morphology changes, worker/UI code, or
  benchmark threshold changes.
- Falsifier: missing/forward parent, duplicate lineage ID, telemetry outside bounds,
  repeated-seed mismatch, or canonical evolution drift.
- Unit observation: all ancestry and telemetry invariants pass for a deterministic
  eight-generation test evolution.
- Benchmark observation: seeds 7, 42, and 99 retained their exact pre-lineage initial/final
  fitness, progress, improvement, and champion checksums; the repeated seed remained exact.
- Decision: **KEEP**. Slice 3 is complete with inspectable lineage and diversity telemetry.

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

## Cycle 5: browser critical journey (predeclared)

- Testable hypothesis: advancing the unchanged deterministic GA one complete generation at
  a time inside a browser worker keeps the main thread interactive while exposing the current
  champion, metrics, component fitness, genome, and ancestry through a single-creature UI.
- Predicted result: the default seed-42, population-12, 30-generation experiment supports
  start, pause, resume, cancellation, restart, replay speed, and camera interaction; pause and
  cancellation settle at a generation boundary; the final champion matches direct evolution;
  and no runtime or console error occurs at 1440 by 900 or 390 by 844 pixels.
- Accessibility gate: the complete journey works by keyboard and pointer, controls have visible
  focus and accessible names, status changes use a live region, logical reading order survives
  the mobile layout, and reduced-motion preference stops automatic replay motion.
- State gate: initial, loading, no-champion, running, paused, completed, cancelled, and error
  states are explicit and recoverable. Only one champion episode is rendered; evaluated
  populations are never rendered.
- Guardrails: no morphology, physics, fitness, GA operator, canonical seed, threshold, backend,
  account, telemetry, or persistence work; persistence remains Slice 6.
- Falsifier: a frozen primary control, request cross-talk, cancellation beyond one completed
  generation, direct/worker result drift, inaccessible critical control, missing state, layout
  obstruction, or browser console/runtime error.
- Initial browser failure: both development and production remained in `loading` without a
  console error because the static worker dependency graph held message-handler registration
  behind Rapier's top-level WASM initialization.
- Bounded revision: register the protocol handler in a 1.53 kB worker entry and dynamically load
  batch/evolution plus the deterministic WASM only after receiving a request. No physics, GA,
  seed, threshold, or UI behavior changed.
- Canonical observation: the default seed-42, population-12 run completed generation 30 in the
  production browser with aggregate fitness `1.82696`, matching the direct canonical value
  `1.8269563074123853`; no browser warning or error was captured.
- Interaction observation: a population-64 run paused at complete generation 12 and remained
  there for a one-second observation, resumed to generation 13, then cancelled with generation
  20 observed immediately before the action and generation 21 retained afterward. Restart had
  already recovered from a prior completed run.
- Layout observation: the 1440 by 900 desktop layout preserved controls, champion, and metrics.
  At 390 by 844, viewport, body, and document widths were all exactly 390 pixels; the controls,
  essential metrics, and champion panel remained in logical vertical order without horizontal
  overflow. The reduced-motion code path stops replay on the terminal stored frame.
- Automation observation: the authored three-test Playwright suite executed against the
  production build in Chromium. All three tests passed in 21.3 seconds and passed again in
  15.5 seconds inside the consolidated release pipeline, covering keyboard
  start/focus, completion, pause/resume/cancel, persistence recovery, unsupported import,
  mobile width, reduced motion, and runtime errors.

## Cycle 6: persistence and recovery (predeclared)

- Testable hypothesis: a strict version-1 JSON document containing the complete inspectable
  generation snapshot and champion episode can round-trip locally without numerical drift.

- Predicted result: local save/load and JSON export/import restore configuration, PRNG identity,
  physics provenance, history genomes, population champion, lineage, component fitness, frames,
  invalid reason, and checksum exactly; corrupt, oversized, non-finite, inconsistent, and
  unsupported-version inputs fail with recovery guidance while leaving the current experiment
  untouched.
- Compatibility policy: version 1 accepts only build `0.0.0`; additive or breaking schema
  changes require a new version and an explicit pure migration. Unknown versions are rejected,
  never guessed.
- Guardrails: restored snapshots are inspectable and restartable, not resumable mid-evolution;
  no arbitrary expressions, backend, sync, account, telemetry, morphology, or migration is added.
- Falsifier: validation after state replacement, silent coercion, non-finite data acceptance,
  checksum/fitness drift, unsupported-version acceptance, storage failure without guidance, or
  an import exceeding the declared byte limit.
- Automated observation: the benchmark document serialized and parsed with exact equality,
  including final checksum; the parsed root and lineage were frozen. Invalid JSON, schema 99,
  inconsistent champion fitness, and 5,000,001-byte input were rejected.
- Browser observation: a completed seed-42 generation-1 run was saved locally, a seed-7 run
  replaced it, and load restored seed 42 plus aggregate fitness `-0.42446` exactly. Importing
  schema 99 changed status to error but retained that same champion fitness and gave explicit
  version/recovery guidance. No console warning or error was captured.
- Decision: **KEEP**. Slice 6 meets the inspectable restore contract. Mid-evolution continuation
  is explicitly excluded from version 1 and documented as a deterministic restart boundary.

## Release-candidate verification

Node 24.14.0 with pnpm 11.9.0 produced:

```text
format: PASS; all matched files use Prettier style
lint: PASS; no ESLint diagnostics
typecheck: PASS; no strict TypeScript diagnostics
tests: PASS; 6 source files, 18 tests
benchmarks: PASS; 4 files, 4 tests; 31.64 seconds
build: PASS; package declarations plus production React/Three/worker bundles
Playwright discovery: PASS; 3 tests in 1 file
Playwright execution: PASS; 3 tests in Chromium; 15.5 seconds in final `pnpm verify`
```

The production build reports a non-fatal chunk-size warning: the deterministic embedded-WASM
chunk is 2,361.44 kB and the React/Three/Zod UI chunk is 803.07 kB (215.50 kB gzip). A warm
default browser repeat reached generation 20 after 5.27 seconds of active observation and
completed within the next three seconds with the canonical fitness. Pause, replay, and controls
remained responsive; optimize only after repeat profiling in additional supported browsers.

`pnpm licenses list --prod --json` reported only Apache-2.0 (Rapier) and MIT (React, React DOM,
Scheduler, Three.js, and Zod) production licences. A live
`pnpm audit --prod --audit-level high` query completed successfully and reported no known
vulnerabilities.

The four protected brief hashes match their Cycle 1 values, `git diff --check` passes, and a
recursive `packages/` plus `apps/` scan found no `Math.random()` calls.

Release decision: **PASS**. The controller-first MVP satisfies the declared automated,
interactive, dependency, integrity, and recovery gates. The production chunk-size warning is
recorded as optimization evidence and does not broaden this release into morphology or neural
controller work.

## Publication preparation

- An MIT licence names `EvoWalker contributors` as the copyright holder without assigning
  ownership to an inferred person or organization.
- `.github/workflows/verify.yml` uses GitHub-maintained checkout and Node setup actions, pins the
  observed Node 24.14.0 and pnpm 11.9.0 toolchain, installs Chromium with its Linux dependencies,
  and runs the repository's unchanged `pnpm verify` gate on pull requests and pushes to `main`.
- After adding the licence and workflow, local `pnpm verify` passed formatting, lint, strict
  TypeScript, 6 test files with 18 tests, 4 benchmark files with 4 tests, the production build,
  and 3 Playwright Chromium journeys. The browser journeys completed in 15.5 seconds.
- Prettier parsed and accepted the workflow YAML as part of that verification. A hosted GitHub
  Actions run is intentionally **UNOBSERVED** until an exact owner, repository name, and
  visibility are confirmed and the local history is pushed.
- Hosted publication observation (2026-08-09): public repository
  `https://github.com/robgreene3/evo-walker` accepted `main` and the annotated
  `controller-first-mvp` tag at verified code commit `384daf3`. GitHub Actions Verify run
  `31319738663` completed successfully in 2 minutes 2 seconds, including frozen dependency
  installation, Chromium installation, and the unchanged consolidated verification gate.

## Cycle 7: clean-checkout verification repair

- Testable defect: a worktree without generated package `dist/` artifacts fails
  `pnpm benchmark` and therefore `pnpm verify`, because the Node worker benchmark imports
  `packages/worker/dist/node-worker.js` before the package build runs. A frozen install also
  exits nonzero because pnpm generated an unresolved `esbuild` build-policy placeholder.
- Predicted result: making `pnpm benchmark` build package artifacts first, removing the now
  redundant package-build step from the later web build, and narrowly allowing the pinned
  `esbuild` postinstall will make both frozen install and the documented standalone benchmark
  succeed from a generated-artifact-free copy.
- Guardrails: no dependency version, lockfile resolution, simulation, benchmark threshold,
  browser behavior, protected brief, Git history, remote, or deferred feature changes.
- Falsifier: a frozen install still exits nonzero; `pnpm benchmark` still depends on stale
  artifacts; the lockfile changes; any automated or browser check regresses; or a dependency
  other than `esbuild` gains lifecycle-script permission.
- Research basis: pnpm 11 documents `allowBuilds` as an explicit package-matcher map and treats
  unlisted lifecycle scripts as errors under the default strict policy. The pinned
  `esbuild@0.28.1` metadata is MIT, the inspected postinstall selects and validates the platform
  binary, `pnpm why` finds one version under Vite, and a live full-graph audit reports no known
  vulnerabilities.
- Clean-state observation: generated `node_modules` and all package/web `dist/` directories were
  moved aside to recoverable temporary backups. `pnpm install --frozen-lockfile` then exited 0,
  reused the locked 200 packages, ran only `esbuild@0.28.1`'s postinstall, and did not change the
  lockfile. Standalone `pnpm benchmark` first rebuilt all packages and then passed 4 files and 4
  tests in 31.52 seconds.
- Consolidated observation: after moving the newly built package outputs aside again,
  `pnpm verify` passed formatting, lint, strict typecheck, 6 files with 18 tests, package build
  plus 4 benchmark files with 4 tests in 30.88 seconds, the production web build, and all 3
  Playwright Chromium journeys in 15.5 seconds. The existing Rapier initialization deprecation
  and production chunk-size warnings remain non-fatal and unchanged.
- Manual production observation: a rebuilt production preview completed a seed-42,
  population-4, generation-1 smoke experiment at aggregate fitness `-0.42446`; browser warning
  and error logs were empty.
- Decision: **KEEP**. The documented install, standalone benchmark, and consolidated verification
  commands now work without warm generated artifacts while retaining pnpm's deny-by-default
  lifecycle policy for every dependency except the reviewed pinned esbuild package.

## Cycle 8: continuous viable gait archive

- User-visible defect: the finite biped demo repeatedly restarted its replay, then stopped with
  a fallen creature; it did not communicate continued emergent evolution.
- Baseline: clean repository at `be0a7c6`; `main`/`origin/main` pointed there and the existing
  `controller-first-mvp` tag pointed to `384daf3`.
- Testable hypothesis: an eight-joint fixed quadruped plus a deterministic, viability-gated
  MAP-Elites-style controller archive can produce sustained visible progress without renderer
  resets or morphology evolution.
- Predicted result: default seed 42 produces a complete non-falling champion and multiple gait
  niches during an ordinary interactive session; search continues until Pause/Stop; checkpoint
  continuation is exact; controls remain responsive.
- Guardrails: fixed topology, periodic controller only, deterministic Rapier and Mulberry32,
  component fitness, preserved briefs/tag, no neural controller, morphology genes, backend,
  telemetry, accounts, or biological/open-ended-evolution claim.
- Falsifier: no viable founder, fallen archive champion, checkpoint drift, main-thread lockup,
  replay renderer recreation on progress, schema replacement before validation, browser console
  error, or benchmark non-improvement.
- Initial failure: the first knee-offset range exceeded its declared controller bound. The
  controller validator rejected it before physics, so the range was corrected without relaxing
  the bound.
- Stability revision: broadened stance, reduced founder amplitudes, and ramped motor targets over
  0.5 seconds. Canonical seed 42 then completed the full six-second trial; moving-but-falling
  seeds remained non-viable and were excluded from the archive.
- Algorithm observation: uninterrupted/resumed core sessions matched exactly. Across seeds 7,
  42, and 99 with 24 founders, an 8×8 archive, and 128 offspring evaluations, archive sizes grew
  `3→13`, `3→16`, and `3→14`. Champion fitness changed `1.491992→1.491992`,
  `0.749283→1.478941`, and `0.426209→1.286761`; all final champions were viable and moved
  `1.324887`, `1.308782`, and `1.116046` metres respectively.
- Browser observation: the live production page reached 57 evaluations and 10/64 niches in about
  1.2 seconds, with fitness `1.37580`, progress `1.2035`, and zero fall penalty. Continued running
  reached evaluation 512, 22/64 niches, fitness `1.48828`, progress `1.3133`, and zero fall
  penalty; Pause held that exact boundary and browser error logs were empty.
- UI observation: Three.js remained mounted while snapshots advanced; champions queue until a
  loop boundary. Full-page inspection showed the quadruped, trace, heatmap, components, all eight
  joint rows, and ancestry together. The authored Chromium suite passed keyboard start,
  pause/resume/stop stability, local save/load, unsupported import, reduced motion, and 390×844
  width in 15.8 seconds.
- Decision: **KEEP**. The user-visible defect is corrected within the controller-first boundary.
  “Gait ecology” means a two-descriptor archive, not open-ended morphology or ecology.

Observed targeted verification before the consolidated release run:

```text
pnpm test
  PASS: 9 files, 25 tests.

pnpm lint && pnpm typecheck && pnpm build
  PASS: no diagnostics; production build completed.

pnpm test:e2e
  PASS: 3 Chromium journeys in 15.8 seconds.

pnpm verify
  PASS: formatting, lint, strict typecheck, 9 files / 25 source tests,
        4 files / 4 benchmark tests in 42.13 seconds, production build,
        and 3 Chromium journeys in 15.8 seconds.
```

The production build retains Vite's advisory for the large deterministic-WASM/Three.js chunks.
It is a measured optimization trigger, not a correctness failure. Profile and code-split before
adding more rendering or simulation dependencies.

## Cycle 9: interactive gait atlas lovability pass

- User-visible uncertainty: the continuous archive is scientifically real and visually legible,
  but occupied cells are passive telemetry; a user cannot experience the diverse creatures the
  archive claims to contain.
- Baseline: clean local commit `e0fba1b`; live default seed 42 reached 112 evaluations and 14/64
  niches during review, but only the aggregate champion could be replayed. The chassis remained a
  plain box and articulated joints were not visually identified.
- Product judgment: **NOT YET LOVED**. The application is credible and handsome, but the most
  distinctive result—behavioral diversity—cannot be touched, compared, or remembered.
- Testable hypothesis: turning occupied archive cells into keyboard-accessible replay controls,
  evaluating the selected genome in a separate inspection worker, and clearly distinguishing
  “live champion” from “atlas specimen” will make discovery experiential while the primary
  evolution worker continues uninterrupted.
- Predicted result: selecting any occupied niche produces its deterministic episode and metadata,
  does not change the archive/evaluation stream, and offers an explicit return to the live
  champion. A modest rounded-chassis and luminous-joint treatment improves creature readability
  without misrepresenting body count or authoritative transforms.
- Guardrails: fixed eight-joint topology and existing controller genes; unchanged physics,
  scoring, descriptors, archive algorithm, canonical seeds, persistence schema, and critical
  controls; no morphology evolution, neural controller, audio dependency, backend, or telemetry.
- Falsifier: selection pauses/restarts evolution, returns a checksum/fitness inconsistent with
  direct simulation, makes empty cells interactive, traps keyboard focus, obscures whether the
  displayed gait is champion or specimen, introduces console errors, or regresses checkpoint and
  benchmark evidence.
- Intervention: worker protocol v2 adds a single-genome deterministic replay request. Occupied
  archive cells became focusable buttons; a dedicated inspection worker must reproduce fitness
  and both behavior descriptors within `1e-9` before the specimen, its controller, components,
  and ancestry replace the display. “Follow live champion” exits inspection without touching the
  exploration worker. The renderer gained a rounded torso and eight luminous joint markers at
  the existing physical anchors; authoritative transforms and physics were unchanged.
- Live browser observation: seed 42 advanced from 195 to 279 evaluations while evaluation 7's
  non-champion gait was selected. Its archived fitness `0.312` reproduced as `0.31160`, its ground
  contact and diagonal-rhythm descriptors reproduced as `0.714` and `0.352`, the archive grew
  from 18 to 19 occupied niches, and returning to the champion restored all champion-labelled
  panels. At later observation the same uninterrupted run had reached 3,038 evaluations, 25/64
  niches, and a viable `1.51858` champion.
- Test revision: the first new Playwright assertion retained `.first()` while the live archive
  inserted cells ahead of the selected one. That locator no longer denoted the activated cell;
  the assertion was corrected to the stable selected-state identity, then the isolated journey
  passed in 8.8 seconds. No product behavior was weakened.
- Consolidated observation: Node 24.14.0 `pnpm verify` passed Prettier, ESLint, strict TypeScript,
  10 source-test files with 27 tests, all 4 canonical benchmark files/tests in 43.03 seconds, the
  production build, and 4 Chromium journeys in 26.5 seconds. The browser journeys record console
  and page errors and observed none. The existing deterministic-WASM/Three.js chunk-size advisory
  and Rapier initialization deprecation notice remain non-fatal.
- Integrity observation: all four protected brief SHA-256 hashes still match Cycle 1,
  `git diff --check` passes, and `packages/` plus `apps/` contain no `Math.random()` calls.
- Decision: **KEEP — personally compelling within the controller-first MVP boundary**. The
  archive now feels like a collection of discoverable living behaviors rather than passive
  telemetry, while every scientific and scope guardrail remains intact. Additional browser
  engines and longer unattended interaction remain release-hardening triggers, not reasons to
  broaden into morphology or neural controllers.

## Cycle 10: browser portability and sustained-run gate

- Remaining uncertainty: the finished controller-first journey is automated only in Chromium;
  the 3,038-evaluation run is useful live evidence but not a repeatable release gate, and the
  reduced-motion mobile journey currently observes only the empty initial state.
- Testable hypothesis: the unchanged production build can run its critical journey in Chromium,
  Firefox, and WebKit, while a canonical seed-42 archive reaches at least 720 complete evaluations
  without main-thread lockup, non-finite metrics, worker failure, or loss of pause/save recovery.
- Predicted result: all three engines pass start, worker execution, checkpoint persistence,
  archive specimen replay, keyboard control, unsupported-import recovery, and reduced-motion
  mobile layout. The sustained Chromium run remains responsive, pauses at a complete boundary,
  retains a viable replay, and serializes a validated local checkpoint.
- Guardrails: no simulation, fitness, controller, archive, schema, dependency-version, topology,
  or benchmark-threshold changes; no test-only application hooks; no claim of cross-engine
  bitwise physics equality without direct evidence.
- Falsifier: any engine cannot initialize Rapier/WebGL or complete the critical path; the soak
  stalls before 720 evaluations, emits an error, produces NaN/Infinity, loses its replay/archive,
  fails to pause/save, or the running 390×844 layout overflows horizontally.
- Targeted cross-engine observation: the unchanged production build passed all eight applicable
  Firefox 153.0 and WebKit 26.5 journeys in 44.8 seconds. Both engines initialized Rapier and
  WebGL, evolved a viable archive, paused/resumed/stopped at evaluation boundaries, restored a
  local checkpoint, rejected the incompatible fixture, reproduced an archive specimen while
  exploration continued, and completed the active reduced-motion 390×844 layout without runtime
  errors or horizontal overflow.
- Sustained-run observation: Playwright Chromium 151.0.7922.34 reached at least 720 complete
  seed-42 evaluations in 1.2 minutes. Pause remained actionable at the next boundary; the replay
  was enabled, stability reported a full trial, aggregate and metric values were finite, an
  occupied archive cell remained visible, local checkpoint serialization succeeded, and Stop
  completed without console/page errors.
- Consolidated observation: Node 24.14.0 `pnpm verify` passed Prettier, ESLint, strict TypeScript,
  10 source-test files with 27 tests, all 4 canonical benchmark files/tests in 40.08 seconds, the
  production build, and the 15-entry browser matrix with 13 passes plus 2 intentional
  non-Chromium soak skips in 1.7 minutes. The pre-existing Rapier initializer and large-chunk
  advisories remain non-fatal and unchanged.
- Release-infrastructure review: the GitHub Actions browser installation was expanded from only
  Chromium to the same pinned Chromium/Firefox/WebKit set required by `pnpm verify`; a hosted run
  for this local branch remains unobserved until publication is separately authorized.
- Integrity observation: all four protected brief hashes still match Cycle 1, `git diff --check`
  passes, and experiment-affecting source contains no `Math.random()` calls.
- Decision: **KEEP**. Multi-engine behavior and the sustained interactive session now have
  repeatable release evidence. This qualifies browser functionality and responsiveness, not
  cross-engine bitwise physics identity; the public `1e-9` numerical policy remains honest until
  directly compared episode evidence exists.

## Cycle 11: deterministic terrain selection pressure

- User-visible slice: let users evolve and replay the unchanged eight-joint quadruped on a flat
  proving ground, gentle rise, low curb trail, or shallow uneven trail, with the exact course
  preserved across workers and checkpoints.
- Baseline: the quality-diversity archive ran only on an infinite flat plane. Level-ground gaits
  were reproducible and inspectable, but viewing did not expose adaptation to changing physical
  demands.
- Testable hypothesis: bounded seeded terrain can make controller evolution visibly more dynamic
  while preserving deterministic reset/replay, useful selection signal, and the flat baseline.
- Predicted result: for each non-flat course, a seed-42 run with 24 founders plus 96 advances finds
  a complete viable champion moving at least `0.25` metres, crossing at least one feature,
  occupying at least three gait niches, and replaying exactly.
- Guardrails: fixed body, eight-joint periodic genome, fitness equation and weights, search
  operators, six-second episode, timestep, canonical flat benchmarks, and no backend/telemetry.
  “Features cleared” is displayed evidence and is not added to fitness.
- Falsifier: a course has no viable feature-crossing controller within the declared budget,
  reset/replay differs, direct/worker terrain differs, persisted terrain changes on restore, or
  the rendered geometry is not generated from the same immutable course description.
- Bounded revisions: the first ramp extended beyond the six-second locomotion envelope, so only
  its length was shortened. Initial curb geometry overlapped the creature's settling stance, so
  the first feature was moved ahead and lowered. The first uneven boundary was similarly moved
  just beyond the stance. No controller, body, fitness, or search parameter changed.
- Targeted benchmark observation: all three non-flat courses passed exact replay and selection
  gates after 120 evaluations each. Gentle rise reached `1.3730 m`, cleared `1/1`, and occupied 5
  niches; curb trail reached `1.2844 m`, cleared `1/2`, and occupied 15 niches; uneven trail
  reached `1.0306 m`, cleared `1/5`, and occupied 12 niches. The test completed in 35.84 seconds.
- Persistence observation: schema v3 records terrain kind, seed, and generator version in search,
  physics, and episode provenance; inconsistent copies fail strict validation. A valid schema-v2
  archive migrates explicitly to flat terrain, while malformed v2 and unsupported v1 inputs fail
  without replacing current state.
- Browser observation: the production terrain save/restore journey passed Chromium, Firefox, and
  WebKit in 32.2 seconds. It ran a seed-99 uneven course, observed an occupied archive and feature
  counts, saved, started flat, restored, and recovered the uneven terrain plus course seed without
  console or page errors.
- Live visual observation: the production UI on an uneven seed-99 course remained responsive past
  122 complete evaluations. It displayed a viable `1.27648` champion with `1.0989 m` forward
  progress, full-trial stability, `1/5` features cleared, four occupied niches, course controls,
  physical terrain, controller genes, fitness components, and ancestry without a runtime error.
- Consolidated local observation: Node 24.14.0 passed Prettier, ESLint, strict TypeScript, all 11
  source-test files with 32 tests, all 5 benchmark files, and the Vite production build. Protected
  brief hashes match Cycle 1; `git diff --check` passes; application source contains no
  `Math.random()` call. Vite retains its existing large-chunk advisory, and Rapier retains its
  non-fatal initialization deprecation notice.
- Verification limit: a final rerun of the complete 18-entry browser matrix, including the
  unchanged 720-evaluation soak, was blocked by the execution environment's external credit
  limit. The new terrain journey itself passed all three engines; Cycle 10 remains the most recent
  full-matrix and soak evidence.
- Decision: **KEEP**. The result adds visible environmental pressure and a longer experimental
  path while retaining controller-first causal clarity. The next bounded improvement should test
  cross-course transfer or curricula before morphology genes.
