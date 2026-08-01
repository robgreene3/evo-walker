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

## Inferred

- A fixed four-joint morphology is the smallest credible articulated controller test
  that satisfies the brief's 4–8 joint range without opening morphology search.
- Exact snapshot repetition in one runtime is a strong leakage detector, but it is not
  evidence for the future complete application's cross-browser reproducibility.

## Research delta and next trigger

The material change from the brief is selecting Rapier's explicit deterministic flavor;
the standard flavor changed its guarantee in Rapier.js 0.15. The next research trigger is
Slice 4 worker behavior and browser support. React, Three.js, schema validation, and
Playwright versions should be refreshed only when their slices begin.
