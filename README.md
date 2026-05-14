# Control

Control is a local-first desktop client for managing GitHub from a macOS glass shell inspired by the provided GitHub concept and Apple Music.app.

V1 is GitHub.com-only and signs in with GitHub through OAuth device flow. Control opens GitHub's verification page, shows the one-time user code in-app, stores the resulting access token in the OS keychain, and loads GitHub data through Octokit with a local SQLite cache for faster repository opens.

## Development

```sh
npm install
npm run dev
```

GitHub account sign-in uses the app-owned OAuth App client ID embedded in the desktop build. In development you can override it with `CONTROL_GITHUB_CLIENT_ID=<client_id> npm run dev`. The OAuth App must have `Enable Device Flow` turned on in GitHub.

## Checks

```sh
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run test:e2e:profile
```

The Playwright E2E project is `testing-profile`. It runs with a fixed desktop viewport, light color scheme, `en-US` locale, `America/Puerto_Rico` timezone, and the storage seed at `tests/e2e/state/testing-profile.json`.

## Scope

- Electron + React + TypeScript.
- macOS-first visual target.
- Local-only storage and credentials.
- GitHub OAuth device-flow sign-in with keychain credential storage.
- Octokit provider for live API reads and writes.
- SQLite repository read model for immediate cached repository rendering.
- Azure DevOps planning docs only; no runtime Azure DevOps integration in V1.
