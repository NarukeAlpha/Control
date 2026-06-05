# Repository Settings Implementation Plan

## Goal

Turn Repository Settings into a polished grouped admin console with clear
permission boundaries, section-local mutation feedback, and shared admin
components.

## Current State

- `RepositorySettingsTab.tsx` includes repository tab visibility, feature
  settings, access, branch protection, rulesets, and forks.
- `RepositoryFeatureSettingsForm.tsx` owns repository feature mutation logic.
- `RepositoryAccessSection.tsx`, `BranchProtectionSection.tsx`, and
  `RepositoryRulesetsSection.tsx` already split admin responsibilities.
- `useBranchProtectionDraft.ts` owns branch protection draft state and tests.
- Source report identifies Settings as one of the roughest admin surfaces.

## Primary Files

- `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx`
- `src/renderer/src/components/repository/settings/RepositoryFeatureSettingsForm.tsx`
- `src/renderer/src/components/repository/settings/RepositoryAccessSection.tsx`
- `src/renderer/src/components/repository/settings/BranchProtectionSection.tsx`
- `src/renderer/src/components/repository/settings/RepositoryRulesetsSection.tsx`
- `src/renderer/src/components/repository/settings/RepositorySettingsTab.queries.ts`
- `src/renderer/src/components/repository/settings/useBranchProtectionDraft.ts`
- `src/renderer/src/components/repository/repositoryAdminQueryKeys.ts`
- `src/main/github/repositoryDomain.ts`
- `src/shared/github.ts`

## Target Layout

```text
Repository settings
├── Status / visibility / default branch summary
├── Control display
│   └── tab visibility preferences
├── GitHub features
│   ├── issues
│   ├── wiki
│   ├── projects
│   ├── discussions
│   ├── merge settings
│   └── archive/disable status
├── Access
│   ├── collaborators
│   └── teams
├── Branch protection
├── Rulesets
├── Fork network
└── Danger zone
```

## Implementation Tasks

- Add shared admin section shell if it reduces repeated headers/status/action
  markup.
- Normalize forms, selects, buttons, checkboxes, segmented controls, and
  disabled-reason affordances through shared primitives instead of one-off
  settings-only markup.
- Move tab visibility into Control display.
- Move feature toggles into GitHub features.
- Keep access and branch protection separate.
- Keep rulesets separate but visually aligned with branch protection.
- Keep branch protection and ruleset sections reusable by Security and Quality;
  avoid extracting them into Settings-only components or styles.
- Keep fork network as a read/inspect section.
- Add danger zone only for destructive actions that exist or are added.
- Rename `Open GitHub fallback` to `Open settings on GitHub`.
- Show top-level administration availability.
- Show per-section availability for branch protection, rulesets, access, and
  forks.
- Keep tab preference optimistic save/rollback behavior.
- Keep branch protection unsupported restrictions explicit.
- Keep admin disabled reasons precise.
- Keep dangerous confirmations.
- Convert sequential sections into grouped cards with stable headers, stable
  action placement, and section-local status text.

## Mutation Feedback

- Feature update feedback belongs near feature card.
- Tab visibility feedback belongs near Control display card.
- Access mutation feedback belongs near Access.
- Branch protection mutation feedback belongs near Branch protection.
- Ruleset mutation feedback belongs near Rulesets.
- Fork network is read-only unless product adds fork actions.

## Tests

- Preserve `useBranchProtectionDraft` tests.
- Add tests for tab preference save rollback if touched.
- Add utility tests for shared admin disabled reasons if extracted.
- Add component tests for section-local mutation feedback if practical.

## Screenshots

- Settings overview dark.
- Feature settings card.
- Branch protection card.
- Rulesets card.
- Access card.
- Small-window responsive state.

## Acceptance Criteria

- Settings is grouped and scannable.
- Grouped cards have stable headers and use shared form/button primitives.
- Control-specific settings are distinct from GitHub admin settings.
- Tab visibility preferences are easier to understand.
- Permission and unavailable states are visible per section.
- Mutation feedback is section-local.
- Fallback wording is gone.
- Required validation passes.
