# Control

Control is a local-first desktop client for GitHub, designed around a macOS glass shell inspired by the provided GitHub concept and Apple Music.app.

V1 is GitHub.com-only and uses the authenticated GitHub CLI account by default. GitHub App OAuth is modeled in settings and provider interfaces for packaged-user flows.

## Development

```sh
npm install
npm run dev
```

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
- GitHub CLI provider for live API reads and writes.
- Azure DevOps planning docs only; no runtime Azure DevOps integration in V1.
