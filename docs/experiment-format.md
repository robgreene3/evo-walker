# Experiment format

## Current format: version 2

EvoWalker exports strict UTF-8 JSON up to 8,000,000 bytes. The root contains:

- `schemaVersion: 2`, `buildVersion`, and mode `continuous-quality-diversity`;
- PRNG identity plus the checkpointed `mulberry32-v1` uint32 state;
- Rapier binding/engine version, fixed timestep, substeps, duration, settling interval, and
  replay snapshot cadence;
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
population/PRNG state. Version 2 deliberately rejects it with recovery guidance. Use the tagged
`controller-first-mvp` build to inspect a v1 file, keep the original export, or implement a tested
explicit migration later. EvoWalker never guesses at incompatible experiment meaning.

## Storage

“Save local” uses `evowalker:experiment:v2`; “Export JSON” downloads the same validated document.
Load/import validates the entire input before replacing state. Clearing site data removes the
local save but cannot remove an exported file.
