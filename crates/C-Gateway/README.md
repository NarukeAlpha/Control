# C-Gateway

`C-Gateway` contains Control's Rust gateway runtime. The crate and binary are still named
`control-gateway`; this directory name exists to make the Rust gateway area easy to spot in the
repository.

## Role

The gateway is a host-local runtime controlled by the Electron main process. It exposes a narrow HTTP
interface for repository discovery, file reads, Git/JJ status, operation preview, operation execution,
operation events, and shutdown.

The gateway is not an autonomous worker. It does not schedule work, poll providers, run background
deployments, or decide to call external services by itself. It acts only when Control starts it or sends
an authenticated request.

## Authentication Layer

Control uses two gateway credentials:

- API token: required for public runtime calls to `/graphql` and `/events`.
- Admin token: required for privileged admin calls such as `/stop`.

The renderer never receives these tokens. The Electron main process owns credential storage, loads tokens
from the OS credential store, and sends only bearer-authenticated requests to the gateway.

Startup passes tokens through token files instead of command-line arguments:

- local startup writes permissioned temporary token files under Control's gateway state directory;
- SSH startup writes permissioned token files on the remote host;
- the Rust runtime reads each token file during bootstrap and removes it after reading;
- token values are not written to the manifest, SQLite gateway records, logs, GraphQL errors, or admin
  responses.

The manifest contains only non-secret runtime facts such as public/admin loopback URLs, version, process
id, start time, and whether tokens are required.

## Credential Policy

The gateway should not become a durable provider credential store. Provider credentials for GitHub,
Hugging Face, cloud hosts, or deployment systems should remain owned by Control's main process unless a
future architecture explicitly introduces autonomous gateway workers.

If a gateway task needs a provider credential, prefer a short-lived, task-scoped credential lease that is
valid only for the requested operation. Do not add broad shared credential database access to the gateway
runtime.

## Runtime Shape

Current modules:

- `src/cli.rs`: command-line arguments and bootstrap paths.
- `src/server.rs`: Axum HTTP listeners, authentication checks, manifest writing, and shutdown.
- `src/api.rs`: GraphQL schema and resolver wiring.
- `src/repository.rs`: root-scoped repository discovery and file reads.
- `src/operations.rs`: Git/JJ operation preview and execution.
- `src/events.rs`: operation event fanout.
