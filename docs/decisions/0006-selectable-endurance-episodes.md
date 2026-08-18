# Decision 0006: Selectable endurance episodes

Status: accepted on 2026-08-17.

## Context

Six-second trials support rapid evolution but cannot reveal whether a gait remains upright and
productive over a longer horizon. Replacing the default outright would multiply evaluation cost
and make the critical journey slower before longer trials had demonstrated useful selection
signal.

## Decision

Keep six simulated seconds as the default quick-search episode and add a user-selectable thirty-
second endurance episode. Both modes retain the fixed `1/120` timestep, 0.75-second settling
interval, morphology, periodic controller, fitness equation, terrain, and quality-diversity
operators. Episode duration crosses worker protocol v4, controls authoritative evaluation and
inspection replay, and is stored in schema-v4 search and physics metadata.

Valid schema-v2 and schema-v3 archives migrate explicitly to six seconds, their only historical
duration. Validation rejects unsupported durations and any disagreement between configuration,
physics metadata, and the stored champion episode.

## Evidence gate

Canonical controllers must reproduce exactly at thirty seconds. A seed-42 run with 24 founders
and 96 advances must produce a complete viable endurance champion moving at least `0.25` metres.
The initial 64-evaluation attempt reached only `0.194837 m` and failed without changing the
threshold. At the established 120-evaluation budget, the gate passed at `0.502754 m`, six niches,
checksum `ab7190ce`, and 52.05 seconds wall time.

## Consequences

- Users can distinguish rapid gait discovery from sustained-gait selection.
- Thirty-second replay is meaningfully longer, while accelerated worker evaluation remains
  off-main-thread.
- Endurance evaluation costs roughly five times more than the six-second baseline.
- Longer duration alone does not create speed, transfer, or open-ended evolution; those remain
  separate measured questions.
