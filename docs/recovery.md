# Recovery and rollback

- The original numbered brief artifacts and `docs/brief/PACKAGE-README.md` remain byte-identical.
- The verified repository baseline is commit `547647c`; deterministic lineage completion is
  commit `68bf8fe`. The browser MVP is isolated on `feat/controller-first-mvp`; its release
  commit contains the UI, worker integration, persistence, documentation, and verification
  evidence as one reviewable controller-first change.
- `node_modules/`, `.pnpm-store/`, build outputs, Playwright reports, and test results are
  generated and ignored. Regenerate them with `pnpm install --frozen-lockfile` and `pnpm build`.
- Browser local saves use `evowalker:experiment:v1`. Export a JSON copy before clearing site
  data or changing browsers. Load/import validates before replacement, so a rejected file leaves
  the current in-memory champion intact.
- Version 1 has no implicit migration. Keep the original export, use a build that supports its
  declared schema, or add a tested pure migration in a later schema version.
- If a dependency update changes canonical outcomes, retain the current lockfile, compare the
  five episode checksums and three evolution seeds, and revert unexplained drift. Never redefine
  tolerance after observing the result.
- If a worker fails, use “Start a fresh experiment”; the seed/configuration remain visible.
  A cancelled run retains its last complete generation for inspection, local save, or export.
- Mid-generation continuation is not recoverable in schema version 1. Restart from the saved seed
  and configuration instead of presenting an approximate continuation as equivalent.
