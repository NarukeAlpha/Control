# UI Regression Checklist

Use this reference for merge conflicts or merge audits involving critical Control UI sections.

## Ask-User Threshold

Ask the user before choosing a final resolution when all are true:

- the conflict affects a critical UI section below
- both sides of the merge could be plausible
- code/tests/screenshots/conversation do not prove the intended behavior
- choosing wrong could remove or reintroduce visible UI

Do not ask vague questions. Name the component, file, selector, and exact UI consequence.

## Component Callback Prompts

### Topbar And Liquid Glass

Files:

- `src/renderer/src/App.tsx`
- `src/renderer/src/components/topbar/TopBar.tsx`
- `src/renderer/src/styles.css`

Ask when the conflict changes topbar overlap, content start position, or scroll glass behavior.

Prompt shape:

```text
I need your call on the topbar/content layout in `App.tsx` and `styles.css`.
Option A keeps [behavior].
Option B keeps [behavior].
Visible consequence: [what moves, overlaps, disappears, or changes while scrolling].
Recommended: [choice] because [evidence].
```

Checks:

- Home content starts below the topbar but scrolls under the liquid glass effect.
- Repository content still aligns under the topbar.
- No hard cutoff appears when scrolling dense content.

### Sidebar Area Navigation

Files:

- `src/renderer/src/components/sidebar/Sidebar.tsx`
- `src/renderer/src/components/areas/AreaTopbarSelector.tsx`
- `src/renderer/src/components/areas/useAreasShell.ts`

Ask when a conflict changes which nav items appear per Area.

Prompt shape:

```text
I need your call on `Sidebar`.
`main` does [visible nav behavior], while this branch does [visible nav behavior].
Should [Area kind] show [nav items]? Recommended: [choice] because [Area boundary or prior request].
```

Checks:

- GitHub Area shows Home, Repositories, Organizations, Mailbox.
- Local and SSH Areas show only Area-relevant nav unless the user requests otherwise.
- Repository search behavior does not query GitHub while browsing Local/SSH Areas.

### Home Dashboards

Files:

- `src/renderer/src/components/home/HomeDashboard.tsx`
- `src/renderer/src/components/areas/LocalAreaHome.tsx`
- `src/renderer/src/styles.css`

Ask when a conflict changes dashboard sections, metrics, or repeated cards.

Prompt shape:

```text
I need your call on the [GitHub/Local/SSH] home dashboard in `[component]`.
One side keeps [section/metric/card], the other removes or restyles it.
Visible consequence: [what the user sees].
Recommended: [choice] because [recent product direction].
```

Checks:

- GitHub Home does not reintroduce removed Recents.
- Latest repository activity remains compact.
- Local/SSH Home does not reintroduce GitHub remotes.
- Recent local work stays refined and Area-scoped.

### Repository Page Shell

Files:

- `src/renderer/src/components/shell/RepositoryRouteSection.tsx`
- `src/renderer/src/components/repository/RepositoryPage.tsx`
- `src/renderer/src/hooks/useRepositoryRouteState.ts`
- `src/renderer/src/styles.css`

Ask when a conflict changes tab layout, right rail behavior, focused issue/PR modes, or page framing.

Checks:

- Repository tabs remain visible and active state is correct.
- Focused issue, pull request, discussion, release, and security routes still open in-app.
- Right rail content does not overlap main content.

### Local Repository Page

Files:

- `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx`
- `src/renderer/src/components/areas/LocalAreaHome.tsx`
- `src/renderer/src/hooks/useAppNavigationActions.ts`

Ask when a conflict changes Local/SSH repository navigation, workspace handling, or local file routes.

Checks:

- Local repository opens from sidebar and Area home.
- Local recent file and repository items route in-app.
- SSH Areas retain gateway status and stop/refresh behavior.
