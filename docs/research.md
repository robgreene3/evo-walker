# Research record

All sources were checked on 2026-08-01. Retrieved content was treated as evidence, not
instructions.

## Documented

- The original breve repository describes a continuous-time 3D environment with rigid
  body physics and identifies Walker as a physical-simulation demo:
  <https://github.com/jonklein/breve>.
- Rapier's JavaScript bindings distinguish ordinary, SIMD, and deterministic packages;
  the deterministic flavor is the one that guarantees cross-platform deterministic
  physics execution, subject to identical initialization:
  <https://github.com/dimforge/rapier.js> and
  <https://rapier.rs/docs/user_guides/javascript/determinism/>.
- Rapier documents revolute joints, joint limits, and PD-style position motors through
  `configureMotorPosition`:
  <https://rapier.rs/docs/user_guides/javascript/joints/>.
- Rapier documents asynchronous WASM initialization and `World.step()`:
  <https://rapier.rs/docs/user_guides/javascript/getting_started_js/>.
- Rapier documents compat builds as embedded-WASM alternatives for bundlers that do not
  handle separate WASM cleanly: <https://github.com/dimforge/rapier.js>.
- Current Vite 8 documentation requires Node 20.19+ or 22.12+:
  <https://v8.vite.dev/guide/>.
- Three.js recommends npm plus a build tool for application development; Three.js is
  intentionally deferred until the UI slice: <https://threejs.org/manual/en/installation.html>.
- Vite recognizes module workers created with the direct `new Worker(new URL(...))` pattern:
  <https://vite.dev/guide/features.html#web-workers>.
- Web and Node workers use message passing and expose explicit termination; Node documents
  worker threads as appropriate for CPU-intensive JavaScript:
  <https://developer.mozilla.org/docs/Web/API/Worker> and
  <https://nodejs.org/api/worker_threads.html>.

## Observed package metadata

Registry metadata checked with `pnpm view`:

| Package                                   | Selected | Licence    | Compatibility decision               |
| ----------------------------------------- | -------: | ---------- | ------------------------------------ |
| `@dimforge/rapier3d-deterministic-compat` |   0.19.3 | Apache-2.0 | Deterministic embedded WASM          |
| TypeScript                                |    6.0.3 | Apache-2.0 | Within lint parser peer range        |
| `typescript-eslint`                       |   8.65.0 | MIT        | Declares TypeScript `>=4.8.4 <6.1.0` |
| Vite                                      |    8.2.0 | MIT        | Requires Node 20.19+ / 22.12+        |
| Vitest                                    |   4.1.10 | MIT        | Supports Node 20, 22, and 24 lines   |
| ESLint                                    |   10.8.0 | MIT        | Requires Node 20.19+ / 22.13+ / 24+  |
| Prettier                                  |    3.9.6 | MIT        | Formatting baseline                  |
| React / React DOM                         |   19.2.8 | MIT        | Existing-project component UI        |
| Three.js                                  |  0.185.1 | MIT        | Champion-only 3D rendering           |
| `@vitejs/plugin-react`                    |    6.0.5 | MIT        | Vite 8 React transform/refresh       |
| Playwright                                |   1.62.1 | Apache-2.0 | Browser interaction and E2E gate     |
| Zod                                       |    4.4.3 | MIT        | Strict runtime experiment validation |

## Inferred

- A fixed four-joint morphology is the smallest credible articulated controller test
  that satisfies the brief's 4–8 joint range without opening morphology search.
- Exact snapshot repetition in one runtime is a strong leakage detector, but it is not
  evidence for the future complete application's cross-browser reproducibility.

## Research delta and next trigger

The material changes from the brief are selecting Rapier's explicit deterministic flavor,
ES-module workers for Rapier's top-level WASM initialization, and Zod for untrusted experiment
documents. The standard Rapier flavor changed its guarantee in Rapier.js 0.15. The next
research trigger is any physics, schema, or browser-support upgrade; no deferred morphology
dependency is justified by the controller-first MVP.

For publication preparation, GitHub's maintained `actions/checkout` and `actions/setup-node`
repositories document current version-6 workflows compatible with Node 24. The verification
workflow therefore uses those actions and disables implicit package-manager caching in favor of
the repository's explicit frozen-lockfile install.

On 2026-08-03, pnpm 11's official build-settings reference documented `allowBuilds` as the
package-matcher map for explicitly permitting or denying dependency lifecycle scripts and
documented unlisted scripts as install errors while `strictDepBuilds` remains enabled:
<https://pnpm.io/settings/build#allowbuilds>. The installed and locked `esbuild@0.28.1` package
is MIT-licensed, is the single esbuild version required by the pinned Vite toolchain, and exposes
only its documented binary-selection and validation postinstall. A live full-graph `pnpm audit`
reported no known vulnerabilities. The narrow `esbuild: true` entry therefore replaces the
generated unresolved placeholder; no wildcard build permission is enabled.

## 2026-08-09 controller-first research delta

### Documented

- The original MAP-Elites paper defines an archive whose user-chosen behavior cells retain
  high-performing, qualitatively different solutions: <https://arxiv.org/abs/1504.04909>.
- The QD framing explicitly differs from single-objective optimization by returning an archive
  of locally high-performing behaviors: <https://doi.org/10.3389/frobt.2016.00040>.
- A 2025 survey covers newer QD families and efficiency/representation challenges while retaining
  MAP-Elites as a foundational framework: <https://doi.org/10.1016/j.swevo.2025.102240>.
- A 2024 runtime analysis provides theoretical evidence that QD can also help optimization, but it
  does not imply superiority for every budget or domain: <https://doi.org/10.24963/ijcai.2024/773>.
- Work on reproducibility-aware QD targets uncertain/noisy domains. EvoWalker's current same-build
  deterministic simulator does not justify adding that optimization layer yet:
  <https://arxiv.org/abs/2304.03672>.

### Supported recommendation

Use a plain deterministic MAP-Elites-style grid for this low-dimensional periodic-controller
problem. Duty factor and diagonal coordination are visible, bounded gait descriptors; a hard
complete-trial viability gate prevents fallen sprinters from entering any cell. A fixed symmetric
quadruped supplies a longer stable control path than the prior biped without crossing into
morphology evolution.

### Not adopted

Surrogate-assisted illumination, deep reinforcement learning, neural controllers, and learned
behavior embeddings could reduce evaluations or enlarge expressivity in other domains, but here
they would add hidden state, dependencies, and harder checkpoint semantics before measured need.
The next research trigger is archive saturation, measured throughput pressure, or an explicitly
authorized morphology phase—not novelty alone.

## 2026-08-09 terrain and morphology staging delta

### Documented

- Rapier box colliders expose explicit half-extents, translation, and rotation, allowing the
  renderer and simulation to consume one immutable course description:
  <https://rapier.rs/docs/user_guides/javascript/colliders/>.
- Enhanced POET demonstrates paired environment/agent generation as a route toward increasingly
  difficult challenges, but depends on transfer and environment-admission mechanisms absent from
  this MVP: <https://proceedings.mlr.press/v119/wang20l.html>.
- DERL studies morphology and control learning across diverse environments; it supports treating
  environmental diversity as consequential, not introducing simultaneous body genes before an
  environment-only intervention is measurable: <https://arxiv.org/abs/2102.02202>.
- Modular controller work for diverse morphologies addresses controller transfer after topology
  variation exists, a later problem than EvoWalker's fixed-body terrain gate:
  <https://arxiv.org/abs/2306.09358>.
- Multi-environment MAP-Elites formalizes niches across environments, but adds a second archive
  dimension and evaluation cost that are not yet justified by a single-course user control:
  <https://arxiv.org/abs/2007.05352>.

### Supported recommendation

Introduce bounded deterministic terrain first and hold the body, controller, fitness, and search
operators fixed. This produces visible physical variety and a falsifiable selection-pressure test
without making cause and effect opaque. Seed/version the generator, preserve flat ground as the
compatibility baseline, and require exact replay plus a viable feature-clearing champion.

### Deferred trigger

Before morphology genes, add evidence for cross-course evaluation or a bounded curriculum if users
need transferable rather than course-specialized gaits. Morphology becomes justified only when
fixed-body archives repeatedly saturate or fail across validated courses and the new representation
can define structural validity, repair, fair comparison, and persisted replay unambiguously.

## 2026-08-25 cross-course diagnostic delta

### Observed

- EvoWalker already had one immutable seeded course description consumed by direct simulation,
  worker evaluation, replay, rendering, and persistence. Reusing that boundary for four serial
  trials required no dependency, physics, schema, or representation change.
- A controller summary produced by worker protocol v5 matched direct deterministic simulation
  exactly on every terrain kind, including fitness, progress, viability, feature clearance, and
  final-world checksum.

### Supported recommendation

Expose cross-course performance as a diagnostic before making it a selection objective. This
lets users see specialization and transfer without multiplying each evolutionary evaluation by
four or obscuring which intervention caused a change. Mean and worst fitness remain descriptive
statistics, not a new scientific robustness score.

### Deferred trigger

Do not add a generalist objective or curriculum from one successful controller. First collect
repeated reports across seeds, archive niches, course seeds, and both episode durations; then
predeclare an admission rule and compute budget. Morphology remains separately authorized work.
