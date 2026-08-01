# Experiment format

## Version 1

EvoWalker exports UTF-8 JSON with a maximum accepted size of 5,000,000 bytes. The root is a
strict object containing:

- `schemaVersion`: `1`;
- `buildVersion`: `0.0.0`;
- `prng.algorithm`: `mulberry32-v1`;
- `physics`: Rapier binding/engine versions, timestep, substeps, duration, settling interval,
  and snapshot cadence;
- `snapshot`: GA configuration, generation, completion flag, all generation summaries and
  their champion genomes, current champion, and complete recorded lineage;
- `championEpisode`: provenance, component and aggregate fitness, invalid reason, energy proxy,
  immutable body frames, termination step, and final world checksum.

Every number must be finite and within declared bounds. Objects reject unknown fields. Arrays,
identifiers, parent counts, frame counts, generation counts, and input bytes are bounded.
Cross-field validation checks history/lineage lengths, unique lineage IDs, completion state,
champion ancestry, champion seed and fitness, and physics provenance.

## Compatibility and migration

Version 1 accepts only its declared schema and build version. Unknown versions fail before UI
state replacement. Additive or breaking changes require a new schema version and a documented,
pure migration with fixtures and round-trip tests. EvoWalker never guesses at an unsupported
format and never executes imported expressions or code.

## Restore semantics

Load/import restores the exact inspectable generation snapshot and champion replay represented
by the document. Same-document JSON round trips are exact in the supported runtime; the final
checksum and every stored number are retained.

Version 1 does not contain the full live population and PRNG state needed to continue breeding
from an intermediate generation. A partial snapshot can be inspected and used as evidence, then
restarted from its saved seed and configuration. This is a deliberate recovery boundary, not a
silent approximation of resume.

## Storage and recovery

“Save local” writes the same validated JSON to the browser key
`evowalker:experiment:v1`. “Export JSON” downloads it. Load/import validates the entire document
first; a failure keeps the current champion and presents a recovery message. Clearing browser
site data removes the local save but cannot remove a downloaded export.
