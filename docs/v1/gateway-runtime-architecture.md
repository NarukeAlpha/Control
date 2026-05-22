# Gateway Runtime Architecture

Control should treat local and SSH repository access through a gateway runtime
that the desktop app can provision, authenticate, update, and manage per
location. The app should not depend on choosing a release binary from GitHub at
connection time. The shipped desktop app should be able to produce or install
the gateway runtime it needs for the selected location.

## Goals

- Support local and SSH repository locations through a managed gateway.
- Provision the gateway from the shipped app instead of fetching an arbitrary
  release at setup time.
- Generate per-location authentication material during gateway provisioning.
- Reconcile gateway credential storage with the platform credential store model.
- Register the gateway as a service where appropriate so it starts reliably.
- Show provisioned locations and keys in settings.
- Keep gateway IPC, storage, and external-link behavior aligned with the strict
  cleanup-v2 architecture.

## Cleanup V2 Baseline

The cleanup-v2-gpt work establishes important boundaries that this architecture
must preserve:

- gateway records are stored through a dedicated gateway store instead of ad hoc
  writes from orchestration code
- gateway lifecycle work crosses process boundaries through strict typed IPC
  routes
- native errors are converted before crossing IPC boundaries
- storage is split into schema, serializer, mapper, and domain-store layers
- external URLs are opened only through the centralized external-link policy

Gateway implementation must extend those boundaries rather than bypass them.

## Target Flow

When a user adds a repository location:

1. The user selects a local or SSH location.
2. Control connects to the location using the appropriate transport.
3. Control installs or replaces the gateway runtime at that location.
4. Control registers the gateway as a local or remote service when supported.
5. Control generates authentication material for that specific location.
6. Control persists the client-side credential according to the storage decision
   below.
7. Control verifies authenticated communication with the gateway.
8. The location becomes available as a repository area.

No unauthenticated local or remote process should be able to interact with the
gateway as a normal client.

## Runtime Distribution

The desktop app should own the gateway runtime version it provisions. The exact
packaging mechanism needs design, but the product rule is:

- do not ask the user to pick a GitHub release
- do not fetch a release binary opportunistically during location setup
- do not leave the gateway version unrelated to the desktop app version

Possible implementation paths:

- bundle prebuilt gateway binaries for supported platforms
- generate or unpack the gateway runtime from app resources
- use a signed embedded artifact with version metadata

The chosen path must support local and SSH deployment without making setup
depend on GitHub availability.

## Authentication Model

Each provisioned location should have its own credential. A credential created
for one location must not authenticate another location.

The gateway should reject requests without valid location-specific
authentication.

cleanup-v2-gpt currently stores gateway `apiToken` and `adminToken` material in
the local SQLite `area_gateways` table. The original target was to store gateway
keys in the platform credential store:

- macOS: Keychain
- Windows: Credential Manager
- Linux: platform support needs a separate decision

This conflict must be resolved explicitly before hardening the gateway design.
The preferred long-term model is to keep non-secret gateway metadata in SQLite
and store secret material in the platform credential store, with SQLite holding
only a stable credential reference. If SQLite token storage remains in v1, the
ADR must call it out as an intentional interim tradeoff with migration and
threat-model notes.

Settings should show the user a list of provisioned locations and the existence
of their credentials. It should not casually expose raw secrets.

## IPC Contract

Gateway lifecycle actions must be exposed as discriminated IPC mutation routes,
not generic stringly typed commands. Each route should have:

- a literal `action` or route discriminator
- a strictly typed input payload
- runtime validation at the IPC boundary
- a Json-serializable result shape
- explicitly tagged failure variants

Gateway failures should be modeled as tagged Effect failures before native Error
conversion. The renderer should receive predictable, serializable error states
instead of raw thrown values or process-specific error objects.

## Service Lifecycle

For each location, Control needs a lifecycle model:

- install
- verify
- start
- stop
- restart
- update
- remove
- repair

For SSH locations, service installation must account for remote OS, permissions,
shell availability, and path conventions. If service registration fails, Control
should report a clear repair path instead of leaving the location half-added.

Every lifecycle action should map to a strict IPC route. Avoid generic
`runGatewayCommand` style endpoints that accept arbitrary command names or loose
payloads.

## Storage Layering

Gateway persistence must follow the cleanup-v2 storage boundary:

- schema definitions own table shape and migration details
- serializers own `parseStorageJson` and `stringifyStorageJson` behavior
- mappers convert storage records into shared domain objects
- domain stores expose gateway-specific read/write operations

Gateway code should not parse JSON blobs inline or write raw storage rows from
IPC handlers. Token fields, credential references, service metadata, runtime
version, and verification timestamps should all pass through the storage mapper
layer.

## Settings Surface

Settings should show gateway-backed locations with:

- location name and path or host
- connection type: local or SSH
- gateway version
- service status
- credential status
- last verified time
- actions to verify, repair, rotate key, remove, or reinstall

Key rotation should create a new credential and update the gateway side without
breaking other locations.

## Failure Behavior

Gateway setup and communication need predictable failure handling:

- failed install does not create an active location
- failed verification keeps the location in a repairable state
- stale gateway version prompts update or repair
- missing credential prompts re-authentication or key rotation
- service stopped state is distinguishable from auth failure
- SSH connection failure is distinguishable from remote gateway failure

Avoid silently falling back to unauthenticated communication.

Gateway errors should preserve enough tagged context for recovery UI:

- install failure
- service registration failure
- service stopped
- authentication failure
- credential missing
- token rejected
- SSH transport failure
- gateway protocol mismatch
- runtime version mismatch

These states should be distinguishable after IPC serialization.

## External Link Policy

Runtime distribution should not introduce a side path for opening external URLs.
If setup, documentation, OAuth, download fallback, or troubleshooting requires
opening a browser URL, that flow must use the centralized main-process
external-link policy boundary.

Gateway provisioning should not call Electron shell APIs directly from feature
code.

## Security Requirements

- Authenticate every gateway request.
- Scope credentials per location.
- Store secrets in the platform credential store when the ADR selects the
  long-term credential model.
- If SQLite token storage is retained temporarily, document the migration path
  and restrict token exposure through storage mappers.
- Avoid logging raw credentials.
- Prefer signed or integrity-checked gateway artifacts.
- Treat SSH deployment as a privileged operation with explicit failure states.

## Open Questions

- Does "produce its own gateway runtime" mean compile on demand, unpack a bundled
  binary, or generate a configured runtime wrapper around a bundled binary?
- What is the Linux credential-store story?
- Which operating systems are supported for SSH gateway hosts in v1?
- How should Control handle gateway downgrades when the desktop app rolls back?
- Should local gateways be per-user services or per-location background
  processes?
- What is the minimum service manager support for macOS, Windows, and Linux?
- Should v1 migrate existing SQLite gateway tokens into the platform credential
  store, or keep SQLite token storage until the gateway hardening phase?

## Recommended Next Step

Write an ADR before implementation. The ADR should decide:

- runtime packaging and versioning
- per-location credential format
- service lifecycle contract
- local vs SSH provisioning boundary
- settings and recovery model
- SQLite metadata vs platform credential-store responsibilities
- gateway IPC route and tagged error contracts

This should be a dedicated architecture branch. It should not be coupled to the
repository page UI cleanup work.

## Validation

Implementation will need unit and integration coverage around provisioning,
credential lookup, authenticated gateway calls, and recovery states.

Required validation before closing implementation work:

- `bun run test`
- `bun run format`
- `bun run lint`
- `bun run typecheck`
