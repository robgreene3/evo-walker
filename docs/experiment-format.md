# Experiment format

## Current format: version 4

EvoWalker exports strict UTF-8 JSON up to 8,000,000 bytes. The root contains:

- `schemaVersion: 4`, `buildVersion`, and mode `continuous-quality-diversity`;
- PRNG identity plus the checkpointed `mulberry32-v1` uint32 state;
- Rapier binding/engine version, fixed timestep, substeps, duration, settling interval, and
  replay snapshot cadence;
- the supported six- or thirty-second episode duration in both search configuration and physics
  metadata;
- terrain kind, course seed, and generator version in physics, search configuration, and episode
  provenance, plus the displayed terrain label and crossed/total feature counts;
- quality-diversity configuration, evaluation count, occupied archive cells, current champion,
  bounded lineage and history, and PRNG snapshot;
- an optional champion episode with provenance, every fitness component, gait descriptor,
  viability/fall evidence, immutable body frames, and checksum.

Every number must be finite and bounded. Objects reject unknown fields. Validation checks unique
and geometrically consistent archive cells, evaluation boundaries, coverage, champion/archive
identity, episode seed/fitness/behavior, viability, and physics provenance before UI state changes.

## Checkpoint semantics

Pause and Stop occur between complete creature trials. Save/export is enabled only at those
boundaries or after a validated load. Continue restores the archive and exact PRNG state, so an
uninterrupted session and a stop/export/import/continue session produce the same subsequent core
snapshot in the supported runtime.

History is capped at 512 points and accepted-lineage records at 4,096 so continuous experiments
remain serializable. Very old ancestry may therefore be summarized out of a long-running file;
the current archive and evolution state remain complete.

## Compatibility

Version 1 represented the earlier finite generational GA and did not contain a resumable
population/PRNG state. Version 4 rejects it with recovery guidance. A valid version-2 archive is
explicitly migrated to flat terrain and a six-second episode because those were its only possible
environment and duration. A valid version-3 archive retains its terrain and migrates explicitly
to six seconds. Malformed legacy input is rejected before state replacement. Keep the original
export, or use the tagged `controller-first-mvp` build to inspect a v1 file. EvoWalker never
guesses at incompatible experiment meaning.

## Storage

“Save local” uses `evowalker:experiment:v4`; “Export JSON” downloads the same validated document.
On first access, the app may read a legacy `evowalker:experiment:v3` or
`evowalker:experiment:v2` entry and migrate it without deleting that fallback. Load/import
validates the entire input before replacing state. Clearing site data removes local saves but
cannot remove an exported file.
