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
- Store gateway keys in the platform credential store.
- Register the gateway as a service where appropriate so it starts reliably.
- Show provisioned locations and keys in settings.

## Target Flow

When a user adds a repository location:

1. The user selects a local or SSH location.
2. Control connects to the location using the appropriate transport.
3. Control installs or replaces the gateway runtime at that location.
4. Control registers the gateway as a local or remote service when supported.
5. Control generates authentication material for that specific location.
6. Control stores the client-side key in macOS Keychain or Windows Credential
   Manager.
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
authentication. The desktop app should store the client-side credential in the
platform credential store:

- macOS: Keychain
- Windows: Credential Manager
- Linux: platform support needs a separate decision

Settings should show the user a list of provisioned locations and the existence
of their credentials. It should not casually expose raw secrets.

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

## Security Requirements

- Authenticate every gateway request.
- Scope credentials per location.
- Store secrets only in the platform credential store.
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

## Recommended Next Step

Write an ADR before implementation. The ADR should decide:

- runtime packaging and versioning
- per-location credential format
- service lifecycle contract
- local vs SSH provisioning boundary
- settings and recovery model

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
