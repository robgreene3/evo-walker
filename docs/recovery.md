# Recovery and rollback

No experiment files, schema migrations, or user data exist in Slices 1–3.

- The original numbered brief artifacts remain byte-identical at the repository root.
- The package-era README is preserved byte-identically in
  `docs/brief/PACKAGE-README.md`.
- `node_modules/`, `.pnpm-store/`, and `packages/*/dist/` are generated and excluded from
  Git; regenerate them with `pnpm install --frozen-lockfile` and `pnpm build`.
- All implementation work is currently uncommitted in the newly initialized repository.
  Review and create the first repository commit before Slice 4 so later changes have a
  clean rollback boundary.
- If a future dependency update changes episode outcomes, retain the lockfile, compare
  the five canonical checksums, and revert the dependency/lockfile change if the drift
  is unexplained. Do not redefine the tolerance after observing drift.
- Import recovery and schema migration policy are intentionally deferred until the
  persistence slice; there is currently nothing to migrate.
