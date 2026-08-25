# Decision 0007: cross-course controller challenge

- Status: accepted
- Date: 2026-08-25

## Context

The fixed quadruped can evolve on four deterministic physical courses, but each archive records
performance on only its selected course. The continuity record called for cross-course evidence
before any body genes. Folding all four terrains into selection immediately would quadruple
evaluation cost and confound the existing course-specific evidence.

## Decision

Add a diagnostic four-course challenge for the currently displayed controller. Worker protocol
v5 runs the same genome, terrain seed, episode duration, physics, and fitness independently on
flat ground, gentle rise, curb trail, and uneven trail. It returns compact summaries without
replay frames. The browser reports per-course viability, fitness, progress, feature clearance,
and checksum plus viable-course count, mean fitness, worst fitness, and worst progress.

The diagnostic uses its own worker and does not modify the archive, PRNG state, checkpoint,
terrain selection, or search objective. Results are intentionally not persisted because they are
derived, reproducible observations rather than authoritative experiment state.

## Consequences

- Users can inspect whether a gait transfers without interrupting evolution.
- Direct and worker results have an exact equality test on every course kind.
- Six-second challenges add four episode evaluations; thirty-second challenges cost roughly five
  times more, matching the existing duration evidence.
- No curriculum, generalist optimization, morphology gene, neural controller, dependency, or
  schema migration is introduced.

## Revisit trigger

Consider a predeclared generalist objective or bounded curriculum only after repeated reports
show a decision-relevant specialization pattern across controller seeds, course seeds, archive
niches, and episode durations. Morphology still requires explicit authorization and separate
validity, repair, comparison, persistence, and replay contracts.
