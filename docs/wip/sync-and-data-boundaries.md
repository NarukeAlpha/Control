# Sync And Data Boundaries

Control is local-first. Sync is not implemented, and the old beta sync strategy
is now too narrow because Areas, gateways, snapshots, and SSH/local metadata have
expanded the data model. This document is the current WIP source for sync and
export boundaries.

## Current State

- Settings, cache entries, GitHub repository read models, pins, recents, Areas,
  repositories, workspaces, snapshots, and gateway records are stored in SQLite.
- GitHub OAuth tokens are stored through the platform credential path.
- Gateway tokens are currently persisted in SQLite gateway records.
- No sync/export/import IPC surface exists.
- No hosted sync backend exists.

## Product Position

V1 remains local-first. Hosted sync is not part of the current implementation
plan. Any export/import or folder-sync feature must come after data boundaries
are classified and secret handling is fixed.

## Data Classification

### Never Sync As Plain Data

- GitHub OAuth tokens.
- Gateway `apiToken` and `adminToken`.
- Platform credential references if they reveal secret material.
- Any future PATs or provider access tokens.

### Privacy-Sensitive

- Local repository paths.
- SSH hosts, users, ports, and remote paths.
- Gateway URLs and location names.
- Repository recents.
- Pinned local repositories.
- Area names when they contain machine- or customer-specific labels.

These may be exportable only with explicit user intent and clear labeling.

### Potentially Syncable

- Non-secret settings.
- Theme preferences.
- Tab visibility preferences.
- Provider display preferences.
- GitHub repository cache metadata when not containing private content.
- Area display metadata after sensitive fields are redacted or user-approved.

### Cache Data

GitHub and local repository cache data should be treated as reconstructable.
Syncing cache can improve startup, but stale-data semantics and invalidation
must remain correct if cache data is missing or intentionally excluded.

## Required Work

- Update storage docs to include the current Area and gateway tables.
- Move or explicitly quarantine gateway secret material before adding export.
- Define a redaction mapper for any future export.
- Add typed export/import IPC only after secret classification is implemented.
- Decide whether settings sync is local-folder based, manual file export, or
  deferred entirely.
- Add tests proving exports redact OAuth tokens, gateway tokens, and other
  secrets.
- Add tests proving cache-only signed-out/offline reads still work without sync
  data.

## Open Questions

- Should v1 support manual encrypted export/import?
- Should theme and tab preferences sync before repository metadata?
- Should local paths be excluded by default even in manual exports?
- Should gateway credential migration block any sync feature?
- Is cache data worth syncing, or should it always be rebuilt?

## Acceptance Criteria

- Current storage boundaries are documented.
- Secret and privacy-sensitive fields are classified.
- Gateway tokens are not casually exportable.
- Any sync/export design has a typed redaction path.
- Hosted sync remains out of scope unless a new plan explicitly adds it.

## Validation

For doc-only updates:

```bash
bun run format:check
```

For sync/export/import implementation:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

Targeted tests should cover storage export redaction, credential lookup, provider
cache-only reads, registerControlIpc, and preload serialization.
