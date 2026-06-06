# Fallback Language And External Links

## Goal

Remove the product framing that Control is only a thin fallback to GitHub while
preserving intentional external links where they help users inspect, share, or
operate on GitHub directly.

## Product Rule

Core repository management surfaces should not say "fallback." If Control owns
the route, the UI should present the in-app experience as primary. A GitHub link
is allowed only when it is a deliberate deep link, not an apology for incomplete
implementation.

## Replace These Labels

- `GitHub fallback`
- `Open GitHub fallback`
- `Open fallback`
- `Open repository fallback`
- `Open project fallback`
- Any copy that implies "Control cannot do this, go to GitHub instead" for a
  core feature that Control is implementing.

## Use These Labels Instead

- `Open on GitHub`
- `Open settings on GitHub`
- `Open project on GitHub`
- `Open wiki page on GitHub`
- `Open security page on GitHub`
- `Open workflow run on GitHub`
- `Open repository on GitHub`

Use the most specific label available.

## Priority Surfaces

- Issue list rows.
- Issue summary and detail.
- Pull request list rows.
- Pull request detail and merge/check sections.
- Projects toolbar, project list, project detail.
- Wiki preview and page actions.
- Repository settings header.
- Organizations route header and selected org/team/project panels.
- Security and Quality section headers.
- Actions workflow/run detail.
- Local connected GitHub surfaces.
- Mailbox notification and work-item rows, especially where an action leaves
  the app or opens a GitHub destination.

## Implementation Tasks

- Search for fallback copy across renderer source.
- Search for external link buttons whose label is generic.
- Decide whether each link should be removed, renamed, or moved to a rail.
- For full issue detail, place `Open on GitHub` in the issue configuration rail
  above status.
- For full PR detail, place `Open on GitHub` in the PR configuration rail above
  state/branch metadata.
- For settings, use `Open settings on GitHub` only when linking to a GitHub
  settings path.
- For wiki, use `Open wiki page on GitHub` for selected page and `Open wiki on
GitHub` for repository wiki.
- For projects, use `Open project on GitHub` only for a selected project.
- For security, use section-specific labels.
- For Actions, link runs, workflow files, artifacts, and logs with precise
  labels.
- Keep icons through shared `ExternalLinkButton`.
- Keep external link placement secondary.
- Update existing tests and benchmark selectors that refer to changed button
  names, roles, aria labels, or fallback copy.
- Check shared `ExternalLinkButton` defaults for aria-label, title, tooltip, or
  copy that still says fallback.

## Tests

- Add or update string-based tests only when the component already has tests.
- Avoid broad snapshot churn.
- Use `rg "fallback"` as a verification command.
- Also search lower-case and label variants:

```bash
rg -i -n "fallback|Open GitHub|GitHub fallback|Open fallback" src docs tests
```

## Acceptance Criteria

- No core repository management surface uses fallback language.
- Existing tests and benchmark selectors are updated when label changes affect
  them.
- External links still exist where useful.
- External link labels are specific and intentional.
- In-app actions remain visually primary.
- Search output shows only historical docs or intentionally retained migration
  notes for fallback terminology.
