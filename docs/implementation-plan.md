# Ordered implementation plan

Status as of 2026-08-01:

1. **Repository and verification baseline — complete.** The brief-only directory is now
   a pnpm TypeScript workspace with Git history ready to begin, pinned dependencies,
   strict checks, an evidence ledger, and protected brief hashes.
2. **Single deterministic creature episode — complete.** One fixed two-hip/two-knee
   morphology runs, scores, snapshots, resets, and replays through deterministic Rapier WASM.
3. **Evolution engine — completion pending.** Seeded controller-only GA operators pass
   deterministic invariant tests and 30-generation improvement gates for three canonical
   seeds. Persisted lineage and diversity telemetry remain before this slice is closed.
4. **Worker evaluation boundary — integration pending.** Typed direct and Node worker
   evaluation match exactly; progress, cancellation, error propagation, and cleanup are
   tested. Browser responsiveness and cancellation remain part of the Slice 5 integration
   gate.
5. **Critical UI journey — blocked on Slice 3 completion.** Add React and Three.js after
   lineage/diversity state is available for inspection.
6. **Persistence and recovery — pending.** Add a validated versioned experiment schema.
7. **Release verification — pending.** Complete browser, accessibility, performance,
   advisory, and recovery gates.

Morphology evolution cannot begin before all seven MVP slices pass.
