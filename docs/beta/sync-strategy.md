# Future Sync Strategy

Control V1 is local-only. Users authenticate separately on each machine and keep direct control of service credentials.

## V1 Behavior

- Settings are stored locally.
- GitHub CLI auth is read from the user's existing `gh` installation.
- GitHub App OAuth tokens, when enabled later, are stored in the OS keychain.
- Cache and recent items live in local SQLite.

## Future Sync Options

Control can support user-controlled sync later without a hosted Control backend.

Candidate approaches:

- Export/import encrypted settings bundles.
- User-selected sync folder for non-secret preferences.
- Git-backed dotfiles-style settings.
- OS cloud storage folder selected by the user.

## Sync Boundaries

Never sync:

- Raw GitHub CLI tokens.
- OAuth access tokens.
- Refresh tokens.
- Keychain entries.

Safe to sync with user approval:

- UI preferences.
- Pinned repositories.
- Recent repositories.
- Provider configuration excluding secrets.
- Cache policy preferences.

## Hosted Sync Consideration

A hosted backend would add account auth, encryption, billing, privacy policy, operational support, and breach risk. It should be deferred until the local product has proven value.

