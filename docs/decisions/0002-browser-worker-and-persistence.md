# Decision 0002: generation-boundary browser worker and strict local persistence

- Status: accepted
- Date: 2026-08-01
- Scope: controller-first browser MVP

## Context

Rapier initializes embedded deterministic WASM asynchronously. Evolution must not block the
main thread, but changing the GA's PRNG order would invalidate the accepted benchmark.
Experiment files are untrusted local input and must restore inspectable state without a
backend.

## Decision

- Preserve the existing GA algorithm and random draws inside an incremental session that
  advances exactly one complete generation per call.
- Run the session in an ES-module worker and yield between generations. Pause and cancellation
  therefore settle at a complete generation boundary.
- Establish the browser worker message handler before dynamically loading Rapier. This keeps
  startup errors observable and avoids holding the protocol behind top-level WASM initialization.
- Keep React and Three.js on the main thread. Render only copied champion episode frames.
- Use Zod 4.4.3 to validate a strict, five-megabyte-limited, version-1 JSON document before
  state replacement. Keep data local unless the user explicitly downloads a JSON export.
- Restore imported snapshots for inspection and deterministic restart; do not claim resume of
  the PRNG/population from an intermediate generation.

## Consequences

Pause/cancel latency is bounded by one population generation rather than one creature episode.
The deterministic compat WASM makes the worker bundle large, while React, Three.js, and Zod
make the UI bundle larger than a minimal static application. This is accepted for the local MVP
and measured before any optimization. A resumable checkpoint would require persisted full
population and PRNG state plus a new schema version.

## Rejected

- Main-thread population evaluation, because it freezes ordinary interaction.
- One worker per creature, because it adds scheduling complexity before evidence requires it.
- Rendering every evaluated creature, because it broadens scope and competes with controls.
- Parsing imports with TypeScript types alone, because types do not validate runtime data.
- Silent schema coercion or best-effort migration, because it can corrupt experiment meaning.
