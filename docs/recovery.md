# Recovery and rollback

- The original numbered brief artifacts and `docs/brief/PACKAGE-README.md` remain byte-identical.
- The verified repository baseline is commit `547647c`; deterministic lineage completion is
  commit `68bf8fe`. The browser MVP is isolated on `feat/controller-first-mvp`; its release
  commit contains the UI, worker integration, persistence, documentation, and verification
  evidence as one reviewable controller-first change. Publication preparation is a separate
  follow-up commit so it can be removed without changing application or experiment behavior.
- `node_modules/`, `.pnpm-store/`, build outputs, Playwright reports, and test results are
  generated and ignored. Regenerate them with `pnpm install --frozen-lockfile` and `pnpm build`.
- Browser local saves use `evowalker:experiment:v4`. Export a JSON copy before clearing site
  data or changing browsers. Load/import validates before replacement, so a rejected file leaves
  the current in-memory champion intact. Earlier `evowalker:experiment:v3` and
  `evowalker:experiment:v2` values are retained as fallbacks after migration.
- Version 4 explicitly migrates valid version-2 and version-3 archives to six-second trials;
  version 2 also migrates to flat terrain. There is no migration from version 1. Keep the
  original export or use the `controller-first-mvp` tag to inspect v1.
- If a dependency update changes canonical outcomes, retain the current lockfile, compare the
  five episode checksums and three evolution seeds, and revert unexplained drift. Never redefine
  tolerance after observing the result.
- If a worker fails, use “Start fresh”; the seed/configuration remain visible. Pause and Stop
  retain the last complete evaluation for save/export.
- Version-4 Continue restores the exact duration, terrain, archive, and PRNG state. If validation
  fails, keep the current in-memory experiment and retain the original file for diagnosis.
