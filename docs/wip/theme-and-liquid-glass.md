# Theme And Liquid Glass

This is the pass-1 implementation plan for converting Control from scattered
light-only renderer colors to a small, typed theme system while preserving the
native macOS Liquid Glass shell. The plan is intentionally scoped to renderer
visual infrastructure, persisted app settings, and visual verification. It is
not a general component redesign.

## Current Ground Truth

- `docs/design/design-system.md` is the design source of truth: macOS uses
  `electron-liquid-glass`; `html`, `body`, `#root`, and the native app shell
  path must not paint over the native material; repeated dense rows should not
  use blur; non-macOS fallback glass must be scoped behind a platform class.
- `src/main/index.ts` currently creates a transparent macOS
  `BrowserWindow`, applies `electron-liquid-glass` after renderer load, uses
  `cornerRadius: 30`, `tintColor: "#FFFFFF00"`, `opaque: true`, and disables
  private scrim/subdued variants. It also forces Electron's native theme source
  to light, so real system/dark theme support must update main-process theme
  resolution instead of only changing renderer CSS.
- `src/renderer/src/main.tsx` currently adds `body.no-liquid-glass` when
  `navigator.platform` is not macOS. That body class is the existing fallback
  switch and should remain the CSS boundary for Windows/Linux or browser-only
  fallback screenshots.
- `src/renderer/src/App.tsx` currently derives shell classes from
  `appState.data?.settings.glassMode`: `glass-shell` is implicit,
  `"reduced"` adds `reduced-glass`, and `"solid"` adds `solid-shell`.
- `src/shared/github.ts` currently defines `GlassMode` as the
  `glass-shell`/`reduced`/`solid` union and `ControlSettings` with
  `credentialProvider` and `glassMode` only.
- `src/main/storage/localStoreHelpers.ts` owns default setting values and
  normalization of persisted settings. `src/main/storage/settingsStore.ts`
  writes settings as individual JSON values in SQLite.
- `src/renderer/src/components/settings/SettingsPanel.tsx` is the only current
  user-facing settings editor for `glassMode`.
- `src/renderer/src/styles.css` is the current visual system. It has a small
  root variable set (`--ink`, `--muted`, `--line`, `--glass`,
  `--glass-strong`, `--glass-border`, `--shadow`, `--blue`, `--green`) and
  many hard-coded light-mode colors across shell, topbar, repository tables,
  markdown, code, right rail, settings, command palette, empty/error states,
  and forms.

## Non-Goals For Pass 1

- Do not redesign navigation, repository layout, route architecture, or data
  loading.
- Do not add Playwright e2e tests unless a later task explicitly requests
  them. Use renderer tests and manual/screenshot validation for this work.
- Do not expose arbitrary theme objects across IPC. Theme settings must be
  literal unions or structured serializable types derived from shared constants.
- Do not attempt to match the Codex app theme system unless product wants that
  as visual reference. If matching Codex is desired, capture reference
  screenshots first, but do not block the Control token migration on unknown
  Codex internals.
- Do not convert syntax highlighting to a full Shiki theme system in this pass.
  Keep code/log tokens simple and compatible with the code viewer upgrade plan.

## Implementation Shape

### 1. Define Typed Theme Settings

Add shared constants and literal unions next to the current settings contracts:

- `src/shared/github.ts`
  - `CONTROL_GLASS_MODES = ["glass-shell", "reduced", "solid"] as const`
  - `CONTROL_GLASS_MODE_LABELS` for Settings UI option labels
  - `CONTROL_THEME_MODES = ["light", "dark", "system"] as const`
  - `CONTROL_THEME_PRESETS` containing `control-light`, `control-dark`,
    `control-dim`, and `control-high-contrast-dark`
  - `CONTROL_ACCENT_COLORS = ["blue", "green", "purple", "gray"] as const`
  - `ControlThemeMode`, `ControlThemePreset`, `ControlAccentColor`
  - `ControlThemeSettings`
  - Extend `ControlSettings` with `theme: ControlThemeSettings`.

Use this shape unless implementation finds an existing better local pattern:

```ts
export interface ControlThemeSettings {
  mode: ControlThemeMode;
  preset: ControlThemePreset;
  accent: ControlAccentColor;
}
```

Default behavior:

- Existing installs must normalize missing theme settings to:
  `{ mode: "system", preset: "control-light", accent: "blue" }`.
- `glassMode` keeps the current default `"glass-shell"`.
- Invalid persisted `glassMode`, theme mode, preset, or accent values fall back
  field by field in `normalizeSettings`; do not reject the entire settings
  object.
- `normalizeSettings` must validate against `CONTROL_GLASS_MODES`,
  `CONTROL_THEME_MODES`, `CONTROL_THEME_PRESETS`, and
  `CONTROL_ACCENT_COLORS`. The settings UI should consume those constants or
  labels instead of casting `event.target.value as GlassMode`.
- Storage remains key/value JSON in the existing settings table.

Files to update in the same slice:

- `src/shared/github.ts`
- `src/main/storage/localStoreHelpers.ts`
- `src/main/storage.test.ts`
- `src/main/effect/ipcBridge.test.ts`
- `src/preload/index.test.ts`
- `src/renderer/src/data/mocks/appState.ts`
- `src/renderer/src/data/mocks/api.ts`
- Any renderer test factories that construct `ControlSettings`.

### 2. Resolve Theme In Main And Renderer

Create one renderer-owned resolver instead of scattering theme logic through
components.

Resolver contract:

- `mode` resolves the requested light/dark family. `mode: "system"` resolves
  to `"light"` when the current system preference is light and `"dark"` when
  the current system preference is dark.
- `preset` is the final visual theme request, not just a family hint. The
  resolver must emit the requested `preset` unchanged as
  `data-theme-preset`, even when it crosses the resolved mode family.
- CSS owns the visual result of cross-family combinations. For example,
  `mode: "dark", preset: "control-light"` emits dark mode metadata with the
  light preset, allowing implementation to either keep the light token block
  with dark native chrome or add an explicit compatibility token block. It must
  not silently rewrite the user's preset.
- `accent` is independent from mode and preset and emits unchanged as
  `data-accent`.
- The resolver returns a serializable view model, for example:

```ts
interface ResolvedControlTheme {
  requestedMode: ControlThemeMode;
  resolvedMode: "light" | "dark";
  preset: ControlThemePreset;
  accent: ControlAccentColor;
  colorScheme: "light" | "dark";
}
```

Required output matrix:

| Input mode | System dark? | Emitted `data-theme-mode` | Emitted `data-color-scheme` |
| ---------- | ------------ | ------------------------- | --------------------------- |
| `light`    | either       | `light`                   | `light`                     |
| `dark`     | either       | `dark`                    | `dark`                      |
| `system`   | `false`      | `system`                  | `light`                     |
| `system`   | `true`       | `system`                  | `dark`                      |

Every row also emits `data-theme-preset={preset}` and
`data-accent={accent}`. `control-light`, `control-dark`, `control-dim`, and
`control-high-contrast-dark` must be accepted with every mode row above; no
combination is disabled in pass 1.

Recommended files:

- `src/renderer/src/theme/themeSettings.ts`
  - Converts `ControlSettings["theme"]` to a resolved theme id.
  - Accepts the current system preference as an input so it is testable.
  - Maps `mode: "system"` to light/dark using `matchMedia`.
- `src/renderer/src/theme/themeSettings.test.ts`
  - Covers light, dark, system-light, system-dark, invalid normalized input
    through shared defaults if a helper is exported.

Renderer application:

- In `src/renderer/src/App.tsx`, add stable shell/root theme classes or data
  attributes on `.app-shell`, for example:
  - `data-theme-mode={resolvedTheme.requestedMode}`
  - `data-color-scheme={resolvedTheme.colorScheme}`
  - `data-theme-preset={resolvedTheme.preset}`
  - `data-accent={resolvedTheme.accent}`
- Add a `matchMedia("(prefers-color-scheme: dark)")` listener in a focused
  hook or theme module, not inline inside unrelated App logic.
- Keep `glassMode` class derivation separate from theme class derivation.

Main process:

- `src/main/index.ts` should stop forcing `nativeTheme.themeSource = "light"`
  once settings support `mode`.
- Add a small main-process helper, for example
  `applyNativeThemeSource(settings: ControlSettings)`, that maps
  `settings.theme.mode` to `nativeTheme.themeSource`:
  - `"system"` -> `"system"`
  - `"light"` -> `"light"`
  - `"dark"` -> `"dark"`
- Bootstrap path: read normalized persisted settings from the local store
  before or during app/window initialization, then call
  `applyNativeThemeSource` before creating or showing the `BrowserWindow` so
  native menus, controls, and material start in the expected mode.
- Update path: settings writes flow through `src/main/ipc/registerControlIpc.ts`
  to `src/main/effect/ipcBridge.ts` and `src/main/storage/localStoreAdapter.ts`.
  After the store returns the merged normalized settings, call
  `applyNativeThemeSource` with that merged result before broadcasting updated
  app state to the renderer.
- Partial write rule: unrelated updates such as
  `GitHubProviderManager` calling
  `store.updateSettings({ credentialProvider: "github-oauth" })` must merge
  over the current normalized settings and keep the existing `theme` object.
  The native theme helper should receive the merged settings, not the partial
  patch, so auth updates neither reset nor skip theme state.
- If implementation cannot safely wire the main-process update path in pass 1,
  document the renderer-only limitation in the PR and add a follow-up issue.
  Prefer main-process alignment for predictable native controls and window
  material.

### 3. Replace Root Variables With Semantic Tokens

Keep CSS variables in `src/renderer/src/styles.css`; do not introduce a new
runtime CSS-in-JS layer.

Replace the current root variables with semantic tokens. The first pass should
include at least:

- Text: `--color-text`, `--color-text-muted`, `--color-text-subtle`,
  `--color-text-inverse`
- Surfaces: `--color-app-background`, `--color-surface-primary`,
  `--color-surface-secondary`, `--color-surface-elevated`,
  `--color-surface-glass`, `--color-surface-solid`,
  `--color-surface-selected`, `--color-surface-hover`
- Borders: `--color-border`, `--color-border-strong`,
  `--color-glass-border`
- Status: `--color-accent`, `--color-accent-muted`, `--color-success`,
  `--color-success-muted`, `--color-warning`, `--color-warning-muted`,
  `--color-danger`, `--color-danger-muted`
- Focus and selection: `--color-focus-ring`, `--color-selection-background`
- Code/logs: `--color-code-background`, `--color-code-text`,
  `--color-code-border`, `--color-diff-addition`,
  `--color-diff-deletion`
- Effects: `--shadow-shell`, `--shadow-panel`, `--shadow-popover`,
  `--glass-panel-blur`, `--glass-panel-saturation`
- Geometry: `--radius-shell: 30px`, `--radius-panel: 18px`,
  `--radius-glass-panel: 24px`, `--radius-control: 10px`,
  `--topbar-height: 52px`

Compatibility aliases are acceptable for one PR if they reduce churn:

```css
--ink: var(--color-text);
--muted: var(--color-text-muted);
--line: var(--color-border);
--glass: var(--color-surface-glass);
--glass-border: var(--color-glass-border);
--blue: var(--color-accent);
--green: var(--color-success);
```

If aliases are kept, add a TODO in the PR description and remove them in the
next token cleanup pass. Do not add new component CSS that consumes the old
alias names.

Token inventory cleanup:

- Fix the existing `.code-preview` `color: var(--text)` reference before or
  during the semantic-token pass. Prefer `--color-code-text` for code preview
  text or `--color-text` if the preview is not a code surface.
- Do not introduce a permanent `--text` alias. If a short-lived alias is needed
  to keep one PR reviewable, define it explicitly in the temporary alias block
  with the same removal plan as `--ink`, `--muted`, and `--line`.

### 4. Preserve Liquid Glass Constraints

Native mode (`body:not(.no-liquid-glass)`) must keep the renderer from covering
the native material:

- `html`, `body`, `#root` stay `background: transparent`.
- Remove or re-scope the current
  `@media not all and (-webkit-min-device-pixel-ratio: 0) { body { ... } }`
  fallback rule in `src/renderer/src/styles.css`. It paints `body` outside the
  `body.no-liquid-glass` boundary and conflicts with the platform-scoped
  fallback contract.
- `.app-shell` base stays full viewport, `margin: 0`, `height: 100vh`,
  `border-radius: var(--radius-shell)`, and transparent.
- Treat `body:not(.no-liquid-glass) .app-shell` as an
  acceptance-sensitive selector. Current CSS sets
  `background: rgba(250, 252, 255, 0.42)`, which can visibly flatten
  `electron-liquid-glass`; remove that background or replace it with an
  intentionally near-transparent token only if before/after screenshots prove
  native material remains visible.
- Keep `src/main/index.ts` `cornerRadius: 30` and CSS
  `--radius-shell: 30px` in sync.
- If changing `tintColor`, verify against
  `node_modules/electron-liquid-glass/src/glass_effect.mm`; the byte order is
  `#RRGGBBAA`.

Blur ownership:

- Persistent glass surfaces may consume `--glass-panel-blur` and
  `--glass-panel-saturation`: `.sidebar`, `.glass-panel`, `.rail-panel`,
  `.settings-panel`, `.setup-panel`, and
  `.right-rail .commit-history-panel`.
- Transient glass surfaces may consume popover-specific blur tokens:
  `.modal-backdrop`, `.area-topbar-menu`, `.command-palette`, and command
  palette panels/list rows. Use `--shadow-popover` and keep opacity high enough
  for readable overlay content.
- Non-glass controls should use solid or translucent surface tokens without
  their own backdrop blur: `.titlebar-provider-button`,
  `.titlebar-platform-button`, `.titlebar-action-button`, regular
  `.icon-button`, repeated rows, table rows, code rows, repository rows, issue
  rows, PR rows, workflow rows, and file rows.
- `body.no-liquid-glass .reduced-glass` must lower blur and saturation by
  overriding the blur/saturation tokens for persistent and transient glass, not
  by adding blur to `.app-shell` alone.
- `.solid-shell` must set persistent/transient glass blur tokens to `0px` or
  remove backdrop filters on panels and popovers while preserving readable
  solid surface, border, and shadow tokens.
- Avoid blur on virtualized or repeated rows in every mode.

Fallback mode (`body.no-liquid-glass`) owns CSS-painted glass:

- Restore the blue-tinted fallback from
  `docs/design/liquid-glass-ui-fixes.md` or replace it with an equivalent
  tokenized multi-stop fallback. The current flat
  `linear-gradient(135deg, #fdfefe, #f8fafc, #f1f6fb)` is too close to plain
  white and should be treated as stale unless screenshots show otherwise.
- `body.no-liquid-glass .app-shell` may keep margin, border, background,
  shadow, and backdrop-filter because native material is absent.
- `body.no-liquid-glass .solid-shell` should use
  `--color-surface-solid`, not a hard-coded `#f8fafc`.
- Reduced glass should reduce blur/saturation across panel tokens, not only
  add blur to `.app-shell`.

Topbar sizing:

- Current CSS uses `grid-template-rows: 52px minmax(0, 1fr)`. Treat `52px` as
  the pass-1 source of truth and encode it as `--topbar-height: 52px`.
- Do not switch to `50px` unless screenshots prove the traffic lights,
  `.topbar`, `.search-wrap`, `.top-actions`, `.icon-button.glass`, and
  `.avatar-button` align better. If changed, update this document and
  `docs/design/design-system.md` in the same implementation PR.

Right rail geometry:

- `.right-rail` is persistent desktop chrome and hidden below the existing
  responsive breakpoint. Its panels should use the same glass radius family as
  the sidebar and should not visually fight `.app-shell` rounded corners.
- Align `.rail-panel` and `.right-rail .commit-history-panel` on one radius:
  either `--radius-panel: 18px` for dense panels or
  `--radius-glass-panel: 24px` for persistent chrome. Do not mix nearby
  values in the same rail.

### 5. Migrate High-Risk CSS Surfaces First

Tokenize by surface, not by searching and replacing color strings globally.
This keeps visual risk reviewable.

Primary files and selectors in `src/renderer/src/styles.css`:

- Shell and persistent chrome:
  - `:root`
  - `body.no-liquid-glass`
  - `.app-shell`
  - `.solid-shell`
  - `.reduced-glass`
  - `.sidebar`
  - `.topbar`
  - `.icon-button`, `.icon-button.glass`, `.avatar-button`
  - `.titlebar-provider-button`, `.titlebar-platform-button`,
    `.titlebar-action-button`
  - `.right-rail`, `.rail-panel`, `.right-rail .commit-history-panel`
- Home and local workspace surfaces:
  - `.account-hero`
  - `.home-panel`
  - `.home-repo-grid`
  - `.local-repository-page`
  - `.local-file-list`
  - `.local-file-preview`
- Common dense surfaces:
  - `.table-panel`
  - `.github-surface`
  - `.collection-view`
  - `.repository-content-scroll`
  - `.repo-hero`
  - `.cached-mode-banner`
  - `.thread-detail`
  - `.timeline-card`, `.timeline-card-header`
  - `.compose-form`
  - `.repository-settings-panel`
  - `.repository-row`
  - `.organization-row`
  - `.mailbox-work-row`
  - `.notification-row`
  - `.organization-profile-summary`
  - `.project-tile`
  - `.metric-tile`
- Status and state:
  - `.state-chip`, `.state-chip.success`, `.state-chip.attention`
  - `.empty-state`, `.loading-state`, `.error-state`
  - `.settings-error`, `.settings-success`
  - `.external-workflow-note`
  - `.workflow-failure-item`
  - `.workflow-log-preview`
  - disabled notes and unavailable/cached banners
- Forms and controls:
  - `.sidebar-repo-filter`
  - `.code-toolbar`
  - `.table-action-row`
  - `.surface-filter`
  - `.issue-metadata-controls`
  - `.metadata-picker-options`
  - `.dark-action`
  - `.ref-picker select`
  - `.settings-panel input`, `.settings-panel select`
  - `.compose-form input`, `.compose-form select`, `.compose-form textarea`
- Popovers and dialogs:
  - `.modal-backdrop`
  - `.settings-panel`
  - `.command-palette`
  - `.area-topbar-menu`
  - `.finder-meta`
  - add/edit/confirm area dialogs because they reuse `.settings-panel`
- Markdown/code:
  - `.markdown-body-lite`
  - `.markdown-code-block`
  - `.markdown-body-lite code`
  - `.markdown-table`
  - code browser file rows and blame/commit panels

Focus-ring selectors must be tokenized explicitly rather than relying on
browser defaults or glass-only box shadows:

- `.icon-button:focus-visible`
- `.repo-tabs button:focus-visible`
- `.repository-row-main:focus-visible`
- `.thread-list-row-main:focus-visible`
- `.command-palette-list button:focus-visible`
- `.metadata-picker-options button:focus-visible`
- `.ref-picker select:focus-visible`
- `.settings-panel input:focus-visible`
- `.settings-panel select:focus-visible`
- `.compose-form textarea:focus-visible`

Component files likely affected only through class names or settings UI:

- `src/renderer/src/components/settings/SettingsPanel.tsx`
- `src/renderer/src/components/topbar/TopBar.tsx`
- `src/renderer/src/components/sidebar/Sidebar.tsx`
- `src/renderer/src/components/right-rail/RightRail.tsx`
- `src/renderer/src/components/repository/RepositoryPage.tsx`
- `src/renderer/src/components/repository/issues/IssuesTab.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx`
- `src/renderer/src/components/repository/actions/ActionsTab.tsx`
- `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx`
- `src/renderer/src/components/repository/wiki/WikiTab.tsx`
- `src/renderer/src/components/repository/security/SecurityQualityTab.tsx`
- `src/renderer/src/components/code-browser/CodeBrowserPage.tsx`
- `src/renderer/src/components/code-browser/codeBrowserUi.tsx`
- `src/renderer/src/components/collection/RepositoriesRoute.tsx`
- `src/renderer/src/components/collection/OrganizationsRoute.tsx`
- `src/renderer/src/components/collection/MailboxRoute.tsx`
- `src/renderer/src/components/command-palette/CommandPalette.tsx`
- `src/renderer/src/components/areas/AreaDialogs.tsx`

Avoid editing component markup unless CSS tokens cannot represent the needed
state. Most pass-1 component work should be settings controls and theme
attributes, not JSX churn.

### 6. Settings UI Details

Update `SettingsPanel` without mixing theme and auth concerns further than
necessary:

- Keep the existing GitHub sign-in controls unchanged except for tokenized
  styling.
- Keep the existing glass mode select, but use shared constants for options
  instead of casting `event.target.value as GlassMode` when practical.
- Add Theme mode:
  - System
  - Light
  - Dark
- Add Preset:
  - Control Light
  - Control Dark
  - Dim
  - High Contrast Dark
- Add Accent:
  - Blue
  - Green
  - Purple
  - Gray
- Disable impossible combinations only if the model truly cannot represent
  them. Otherwise allow any mode/preset/accent combination and define how it
  resolves.
- Save a complete `theme` object with `glassMode` in one settings update.
- On save failure, preserve the user's unsaved local selection and show the
  current settings error path.
- Add or update renderer tests that open settings, change glass mode, theme
  mode, preset, and accent, save, and assert `api.updateSettings` receives the
  typed shape.
- Add a failure-path renderer test where the settings save rejects after the
  user changes `glassMode`, `theme.mode`, `theme.preset`, and `theme.accent`;
  assert the changed selections remain selected and `.settings-error` remains
  visible.

## Accessibility And Contrast

Minimum contrast targets:

- Body and dense row text: WCAG AA, 4.5:1 against the effective surface.
- Muted metadata: at least 3:1, and preferably 4.5:1 in dense tables.
- Icon-only controls: visible boundary and state in light, dark, reduced glass,
  and fallback glass.
- Focus rings: visible on every tokenized surface; do not rely on box-shadow
  that disappears on glass.
- Danger/warning/success states: color plus text/icon/border shape. Do not
  rely on hue alone.
- Disabled controls: do not rely on global opacity alone. Disabled text,
  border, and background tokens must meet the same readability expectations
  against the effective surface.

Specific checks:

- `.state-chip.success` and `.state-chip.attention` must remain readable in
  dark and high-contrast dark presets.
- `.error-state` and dangerous buttons must not use low-alpha red text on
  transparent glass.
- `.markdown-code-block`, logs, diff additions/deletions, and inline code must
  remain readable in every preset.
- `button:disabled { opacity: 0.56; }` may fail contrast in dark mode. Prefer
  tokenized disabled text/background/border values for primary controls if
  screenshots show low contrast.
- Run a selector-level contrast pass for `button:disabled`,
  `.dark-action:disabled`, `.settings-error`, `.rail-error`,
  `.workflow-failure-item`, `.markdown-unsafe`, `.deletions`,
  `.state-chip.attention`, and `.settings-panel .danger-button` against
  light, dark, dim, high-contrast dark, native glass, and
  `body.no-liquid-glass` fallback surfaces.
- Verify keyboard focus visibility for `.icon-button`, `.repo-tabs button`,
  `.repository-row-main`, `.thread-list-row-main`,
  `.command-palette-list button`, `.metadata-picker-options button`,
  `.ref-picker select`, `.settings-panel input/select`, and
  `.compose-form textarea` in each preset.
- Respect reduced-motion expectations if adding transitions for theme changes;
  do not animate large glass surfaces by default.

## Visual Regression Risks

- Painting `.app-shell` in native mode can flatten or hide the real Liquid
  Glass material and make rounded corners appear wrong.
- Non-macOS fallback and macOS native paths share many selectors. Keep
  `body.no-liquid-glass` overrides narrow so fallback styles do not leak into
  native mode.
- Dark mode can make transparent panels inherit wallpaper colors. Use neutral
  low-alpha surfaces and test over neutral, blue, and yellow wallpapers.
- The right rail has both `.rail-panel` and `.commit-history-panel`; mismatched
  radii, blur, or background opacity are easy to notice beside the shell edge.
- Repository rows, issue rows, PR rows, commit rows, and file rows are dense
  repeated content. Adding blur or heavy shadows there will hurt performance.
- Current code uses old aliases and hard-coded colors side by side. A partial
  migration can produce unreadable mixed states such as dark text on dark
  panels or light borders on light panels.
- `nativeTheme.themeSource` affects native menus and Electron material; renderer
  theme without main-process alignment may look correct in browser screenshots
  but wrong in Electron.

## Sequencing

1. Add shared glass/theme constants, labels, types, defaults, and storage
   normalization. Update mocks and compile/test fixtures before touching CSS.
2. Add the renderer theme resolver contract and tests, including the
   cross-family mode/preset matrix and `matchMedia` system changes.
3. Wire resolved theme attributes/classes into `.app-shell` and settings save
   tests, including the save-rejection local-state test.
4. Wire main-process native theme ownership: bootstrap from persisted
   normalized settings, update `nativeTheme.themeSource` after merged settings
   writes, and preserve theme through unrelated partial writes.
5. Replace root CSS variables with semantic tokens plus temporary aliases. Add
   light and dark token blocks first; then dim and high-contrast dark. Fix
   `.code-preview` `var(--text)` in this step.
6. Fix Liquid Glass shell constraints: transparent native `.app-shell`,
   removal/re-scope of the unscoped fallback media rule, tokenized
   `body.no-liquid-glass`, synced shell radius, and tokenized
   glass/reduced/solid modes.
7. Tokenize shell, topbar, sidebar, right rail, settings, command palette,
   popovers, titlebar controls, focus rings, and common controls.
8. Tokenize home, local repository, repository, collection, issue, PR, action,
   security, workflow, code browser, markdown, empty/loading/error, disabled,
   warning, danger, success, and form surfaces.
9. Run focused tests, React diagnostics, then full repository validation
   commands.
10. Run screenshot/browser validation across presets and both glass modes. Fix
    contrast/layout regressions before closing.

## Acceptance Criteria

- `ControlSettings` includes typed, JSON-serializable theme settings with
  shared constants, defaults, normalization, mocks, and IPC/preload tests.
- Settings UI can save glass mode, theme mode, preset, and accent without
  exposing raw color dictionaries.
- Settings UI keeps unsaved local selections visible and shows
  `.settings-error` when saving glass/theme changes fails.
- System mode resolves from OS preference and updates when the preference
  changes while the app is open.
- `nativeTheme.themeSource` is aligned with normalized persisted theme mode at
  bootstrap and after merged settings writes, including partial writes that do
  not include `theme`. If this is intentionally deferred, the PR must document
  renderer-only behavior and create a follow-up issue.
- Native macOS Liquid Glass path keeps `html`, `body`, `#root`, and
  `.app-shell` effectively transparent above the native material.
- The unscoped fallback media rule that paints `body` is removed or scoped
  under `body.no-liquid-glass`.
- `body:not(.no-liquid-glass) .app-shell` no longer paints a flattening
  background over native Liquid Glass, or before/after screenshots prove the
  retained token is visually transparent.
- Non-macOS/browser fallback path has an intentional blue-tinted glass
  background scoped to `body.no-liquid-glass`.
- `glass-shell`, `reduced`, and `solid` modes all work in light, dark, dim, and
  high-contrast dark presets.
- Persistent glass, transient glass, non-glass controls, `reduced-glass`, and
  `solid-shell` each consume the correct blur/saturation token family.
- The right rail, sidebar, settings panel, command palette, and detail panels
  use consistent radius and glass token families.
- Dense repository, issue, PR, action, code, markdown, empty, loading, error,
  warning, success, and disabled states are readable in every preset.
- Home, local repository, timeline, collection rows, notifications, projects,
  metrics, workflow failure/log, area menu, titlebar controls, and finder
  metadata surfaces do not retain hard-coded light-only colors.
- `.code-preview` no longer references undefined `--text`.
- No newly touched CSS consumes old alias tokens (`--ink`, `--muted`, `--line`,
  `--blue`, `--green`, `--glass`) except in the temporary alias block.
- Repeated row surfaces do not gain backdrop blur or heavy shadows.
- Focus indicators are visible on buttons, selects, text inputs, command
  palette rows, repository rows, and code browser file rows in every preset.

## Screenshot And Browser Validation

Capture screenshots for each theme preset in both native and fallback paths.

Native Electron validation:

- Run `bun run dev` on macOS.
- Capture focused and unfocused screenshots.
- Test at minimum:
  - Home/account dashboard
  - Repository Code tab with right rail
  - Issues tab with selected detail
  - Pull Requests tab with selected detail and review/status chips
  - Actions tab or workflow run surface
  - Code browser markdown/code file
  - Settings panel
  - Command palette
- Repeat over neutral, blue, and yellow desktop backgrounds if Liquid Glass
  tint changed or any native/app-shell transparency changed.
- Confirm traffic lights, search, topbar actions, provider button, and avatar
  do not overlap at the default `1512x982` window and at `1120x760` minimum.
- Capture command palette and settings overlay screenshots in both focused and
  unfocused window states because those surfaces paint their own modal and
  popover backgrounds.

Fallback/browser validation:

- Run `bun run dev:renderer` for fast CSS checks.
- Use a deterministic, uncommitted browser setup for each screenshot instead of
  relying on ad hoc manual toggles. In DevTools console or Playwright evaluate,
  force the state with:

```js
document.body.classList.add("no-liquid-glass");
const shell = document.querySelector(".app-shell");
shell?.setAttribute("data-theme-mode", "system");
shell?.setAttribute("data-color-scheme", "dark");
shell?.setAttribute("data-theme-preset", "control-high-contrast-dark");
shell?.setAttribute("data-accent", "blue");
```

- Repeat the same attribute forcing for each preset/accent combination being
  captured. Do not commit temporary dev overrides or fixtures unless a later
  task explicitly asks for a screenshot harness.
- Capture fallback screenshots at `1512x982`, `1120x760`, and one width below
  the documented `1180px` right-rail breakpoint.
- Verify `.right-rail` hides below the existing breakpoint without leaving
  odd borders or clipped content.
- Capture command palette and settings overlay screenshots in fallback mode
  because `.modal-backdrop`, `.command-palette`, and `.settings-panel` have
  independent backgrounds and blur tokens.

Screenshot comparison should focus on:

- Native material remains visible in macOS mode.
- Fallback mode reads as intentional glass, not plain white.
- Text and state chips remain readable.
- No clipped text in buttons, settings controls, command palette rows, tabs,
  or right-rail cards.
- No new scrollbars appear on shell panels unless the surface is intended to
  scroll.

## Required Tests And Commands

Focused tests to add or update:

```bash
bun run test -- src/main/storage.test.ts src/main/effect/ipcBridge.test.ts src/preload/index.test.ts
bun run test -- src/renderer/src/App.test.tsx
```

Add targeted renderer tests if theme resolver/settings UI are extracted. The
settings test must include both the successful typed payload assertion and the
save-rejection local-state persistence case:

```bash
bun run test -- src/renderer/src/theme/themeSettings.test.ts
bun run test -- src/renderer/src/components/settings/SettingsPanel.test.tsx
```

Run React diagnostics after the renderer wiring is complete:

```bash
react-doctor . --offline
```

Required before closing implementation work:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
bun run build
```

Do not call `vitest` directly. Use `bun run test`.
