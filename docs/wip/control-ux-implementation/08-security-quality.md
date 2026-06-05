# Security And Quality Implementation Plan

## Goal

Make Security and Quality operational, section-resilient, and GitHub-like rather
than a passive or brittle admin dump.

## Current State

- `SecurityQualityTab.tsx` already defines security links, alert summaries,
  security feature rows, branch protection and ruleset mutations, selected
  recent security item handling, and path/deep-link helpers.
- `SecurityQualityTab.queries.ts` owns alert, ruleset, security policy,
  community profile, and branch/ref related queries.
- `uiStore.ts` already has `securityItemKind` and `securityItemId`.
- Repository settings already owns overlapping admin surfaces like branch
  protection and rulesets.

## Primary Files

- `src/renderer/src/components/repository/security/SecurityQualityTab.tsx`
- `src/renderer/src/components/repository/security/SecurityQualityTab.queries.ts`
- `src/renderer/src/components/repository/settings/BranchProtectionSection.tsx`
- `src/renderer/src/components/repository/settings/RepositoryRulesetsSection.tsx`
- `src/main/github/securityDomain.ts`
- `src/main/github/repositoryDomain.ts`
- `src/shared/github.ts`
- `src/shared/local.ts`

## Parity Matrix

Each section needs loading, available, empty, permission denied, feature
disabled, cached, stale, rate-limited, and generic error states where relevant.

- Security policy.
- Code scanning alerts.
- Dependabot alerts.
- Secret scanning alerts.
- Repository rulesets.
- Branch protection.
- Security advisories.
- Community profile.
- Repository security and analysis settings.
- Pulse or quality summaries only if exposed by available APIs; do not block
  the route on unavailable quality-summary data.

## UI Requirements

- Keep all usable sections visible when one section fails.
- Put availability messages near the failing section.
- Show alert state, severity, rule, package, path, branch/ref, and updated date
  where available.
- Route code/path alerts into code browser when path exists.
- Use `Open security page on GitHub` or section-specific labels for external
  links.
- Security alert deep links should open the exact GitHub alert page when the API
  exposes a URL, while code/path alerts still route into the in-app code browser
  when a file path exists.
- Keep branch protection and ruleset actions confirmation-gated.
- Keep permission disabled reasons exact.
- Reuse admin section components from Settings when available.
- Match repository route visual language: tabs, headers, surface wrappers,
  empty states, buttons, and rail/card density should feel like the same app as
  Issues, PRs, Actions, and Settings.
- Add `open`, `dismissed`, and `fixed` state filters for alert lists where the
  provider supports those states.

## Data Requirements

- Preserve partial security data.
- Avoid combining unrelated endpoint failures.
- Avoid polling high-cost security endpoints.
- Cache section results independently.
- If a selected security item is absent from current limited list, fetch detail
  if provider supports it or show a precise unavailable state.

## Tests

- Section unavailable does not blank route.
- Permission-denied security endpoint renders section message.
- Branch protection/ruleset mutation disabled reasons remain correct.
- Selected security item route state works if changed.
- Alert state filters work if added.

## Screenshots

- Populated Security and Quality route.
- Partial unavailable route.
- Alert selected state.
- Branch protection/ruleset admin action disabled state.
- Dark theme.

## Acceptance Criteria

- Security and Quality is useful under partial permissions.
- Users can navigate from alerts to code or GitHub deep links.
- Security and Quality looks like part of the same repository UI, not a
  standalone admin dump.
- Section failures remain contained.
- Admin actions remain safe.
- Required validation passes.
