# Ordered implementation plan

Status as of 2026-08-01:

1. **Repository and verification baseline — complete.** The brief-only directory is now
   a pnpm TypeScript workspace with Git history ready to begin, pinned dependencies,
   strict checks, an evidence ledger, and protected brief hashes.
2. **Single deterministic creature episode — complete.** One fixed two-hip/two-knee
   morphology runs, scores, snapshots, resets, and replays through deterministic Rapier WASM.
3. **Evolution engine — complete.** Seeded controller-only GA operators pass deterministic
   invariant and 30-generation improvement gates for three canonical seeds; immutable
   lineage plus median-fitness, duplicate-rate, and genotype-distance telemetry are recorded.
4. **Worker evaluation boundary — complete.** Typed direct and Node worker
   evaluation match exactly; progress, cancellation, error propagation, and cleanup are
   tested. Browser responsiveness and cancellation remain part of the Slice 5 integration
   gate.
5. **Critical UI journey — complete with browser evidence.** React and Three.js integrate the
   browser worker; the observed default journey, responsive layouts, and cancellation gate pass.
6. **Persistence and recovery — complete.** Versioned local and JSON state is strictly validated.
7. **Release verification — complete.** Automated Chromium, Firefox, and WebKit journeys,
   accessibility and responsive behavior, a 720-evaluation sustained-run gate, performance
   evidence, production advisory, integrity, and recovery gates pass.

All seven controller-first MVP slices pass. Morphology evolution remains out of scope and requires
separate explicit authorization.

## Controller-first post-MVP correction — complete

The fixed body is now an eight-joint quadruped and the primary worker runs a resumable continuous
quality-diversity archive. Viability-gated scoring, gait descriptors, deterministic checkpoint
resume, uninterrupted replay, archive visualization, revised benchmarks, and browser journeys
pass. The older generational GA remains as a compatibility baseline; body topology still does not
evolve.

## Controller-first terrain generalization — complete

The fixed morphology and periodic controller now run on four deterministic physical courses.
Terrain configuration is shared by direct simulation, worker evaluation, replay rendering, and
schema-v4 persistence. The original flat course remains unchanged; a seeded mild-course benchmark
and three-engine save/restore journey prove useful selection signal and reproducible recovery.
Morphology, controller representation, fitness weights, and evolutionary operators remain fixed.

## Selectable endurance episodes — complete

Six-second quick trials remain the default. A persisted thirty-second endurance option uses the
same fixed timestep, body, controller, fitness, archive, terrain, and worker boundary. A bounded
comparison and 120-evaluation search gate establish exact replay and a viable sustained champion;
the longer mode costs roughly five times more computation and is labelled accordingly.
