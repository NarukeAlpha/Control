# Gateway Runtime Architecture

Control should treat local and SSH repository access through a gateway runtime
that the desktop app can provision, authenticate, update, and manage per
location. This document replaces the old v1 gateway plan and keeps the unresolved
credential and lifecycle decisions explicit.

## Current State

- Gateway records are stored through a dedicated gateway store.
- Gateway lifecycle work crosses process boundaries through typed IPC routes.
- Local and SSH Areas have enough plumbing to appear in the product.
- Gateway `apiToken` and `adminToken` material is currently persisted in SQLite
  gateway records.

## Problem

The current token storage conflicts with the preferred credential boundary.
GitHub OAuth tokens use the platform credential store; gateway credentials
should follow the same security model unless an ADR explicitly accepts SQLite as
an interim tradeoff.

## Required Decisions

- Runtime packaging:
  - bundled binary
  - generated runtime from app resources
  - signed embedded artifact
- Per-location credential format.
- Platform credential-store behavior for macOS, Windows, and Linux.
- Whether existing SQLite gateway tokens migrate in v1.
- Local vs SSH provisioning boundary.
- Service lifecycle contract.
- Settings and recovery UX.
- Gateway IPC route and tagged error contracts.

## Target Flow

1. User selects a local or SSH location.
2. Control connects using the selected transport.
3. Control installs or replaces the gateway runtime for that location.
4. Control registers the gateway as a local or remote service when supported.
5. Control generates per-location authentication material.
6. Control persists non-secret metadata in SQLite.
7. Control stores secret material in the platform credential store, or records a
   documented interim SQLite tradeoff.
8. Control verifies authenticated gateway communication.
9. The location becomes available as a repository Area.

## IPC Contract

Gateway lifecycle actions must use strict IPC routes, not generic stringly typed
commands. Each route should have:

- a literal route or action discriminator
- a strictly typed input payload
- runtime validation at the IPC boundary
- a JSON-serializable result shape
- explicitly tagged failure variants

Avoid `runGatewayCommand` style endpoints.

## Service Lifecycle

Each location needs a lifecycle model:

- install
- verify
- start
- stop
- restart
- update
- remove
- repair
- rotate credential

For SSH locations, the lifecycle must account for remote OS, permissions, shell
availability, path conventions, and service manager support.

## Storage Boundary

Gateway persistence must follow the split storage pattern:

- schema owns table shape and migrations
- serializers own JSON parsing and stringification
- mappers convert storage rows into shared domain objects
- domain stores expose gateway-specific read/write operations

Token fields, credential references, service metadata, runtime version, and
verification timestamps should all pass through mappers. Feature code should not
parse raw JSON blobs from storage.

## Failure Behavior

Gateway errors must preserve enough tagged context for recovery UI:

- install failure
- service registration failure
- service stopped
- authentication failure
- credential missing
- token rejected
- SSH transport failure
- gateway protocol mismatch
- runtime version mismatch

Do not silently fall back to unauthenticated communication.

## Security Requirements

- Authenticate every gateway request.
- Scope credentials per location.
- Store secrets in the platform credential store when the ADR selects that model.
- If SQLite token storage remains temporarily, document the migration path and
  threat-model tradeoff.
- Avoid logging raw credentials.
- Prefer signed or integrity-checked gateway artifacts.
- Treat SSH deployment as privileged and failure-prone.

## Next Step

Write an ADR before hardening implementation. The ADR should decide runtime
packaging, credential storage, service lifecycle, settings UX, recovery states,
and token migration.

## Validation

Required before closing implementation work:

```bash
bun run test
bun run format
bun run lint
bun run typecheck
```

Add targeted coverage around provisioning, credential lookup, authenticated
gateway calls, token redaction, and recovery states.
