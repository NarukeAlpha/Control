# Front-End UI Findings: feature/github-integration

An analysis of the `feature/github-integration` branch was conducted against the Liquid Glass design pattern rules (as documented in `docs/design/design-system.md` and `docs/design/liquid-glass-ui-fixes.md`). Several inconsistencies and regressions were found within the UI implementation.

## 1. Feature Branch Specific Issues

These issues were introduced in the feature branch and contradict the established design language:

### Non-Standard Font Weights

The CSS introduces custom font weights that fall between standard system font weight stops (400, 500, 600, 700). These render inconsistently and often snap poorly to the nearest available weight on macOS:

- `font-weight: 650` applied to `.repo-name`
- `font-weight: 750` applied to `.repo-meta, .repo-source`
- `font-weight: 620` applied to `.collection-section-label`

**Fix:** Standardize weights to `600` (semibold) or `700` (bold) per Apple's system font specifications.

### Accessibility Violation: 10px Micro-Text

`.repo-meta, .repo-source` uses `font-size: 10px` combined with a heavy `font-weight: 750`.

- 10px text falls below accessibility minimums for readability.
- When rendered on translucent glass backgrounds with varying contrast ratios, micro-text becomes extremely difficult to read.

**Fix:** Ensure base metadata text is no smaller than `12px` (`11px` absolute minimum for non-critical badges).

### Detail Panel Border Radius Inconsistency

The newly introduced detail panels (`.contributor-detail-panel`, `.organization-member-detail-panel`, `.organization-project-detail-panel`) use `border-radius: 8px`.

- The glass panel standard across the app is `18px`, and the sidebar uses `24px`.
- `8px` makes these panels look unusually sharp and visually disconnects them from the "Liquid Glass" aesthetic.

**Fix:** Update panel border-radius to match the `18px` standard.

### Sub-Pixel Layout Shift

The `.app-shell` `grid-template-rows` was changed from `50px minmax(0, 1fr)` to `52px minmax(0, 1fr)`. This 2px drift on the top bar row is not mirrored consistently across all top-bar related height calculations, potentially causing sub-pixel layout shifts and misalignment.

## 2. Pre-Existing Regressions (Affects both branches)

These issues exist in both the `main` and feature branches but represent severe regressions from the originally documented Liquid Glass fixes.

### Critical: Opaque Overlay Blocking Native Glass

The CSS rule `body:not(.no-liquid-glass) .app-shell` sets `background: rgba(229, 231, 235, 0.26)`.

- **Why it's broken:** This paints a 26% opaque gray overlay _on top_ of the native macOS `electron-liquid-glass` material.
- **Design Rule Violation:** The `liquid-glass-ui-fixes.md` explicitly states that `.app-shell` must have `background: transparent` so the native material shows through completely.
- **Visual Impact:** It dulls the native glass effect, masks the native `cornerRadius: 30`, and forces a flat gray tint regardless of what's behind the window.

### Non-Standard Fallback Gradient

The `body.no-liquid-glass` fallback for non-macOS platforms uses a gray gradient: `linear-gradient(135deg, #eef0f3 0%, #e7eaee 42%, #d7dde5 100%)`.

- The documented fallback is supposed to be blue-tinted (`#d8e9fb` to `#cfe2f8`) to emulate the Apple Music.app inspiration.
- The current implementation reads "gravel" rather than "glass."

### Disconnected Right Rail Corners

`.right-rail` explicitly sets `border-radius: 0`.

- While individual `.rail-panel` children are rounded, the container itself being square creates a visual dissonance when placed against the `30px` rounded corner of the `.app-shell`. The container technically cuts into the rounded corner space.

### Dead UI: "Reduced Glass" Setting

The settings dropdown offers `glass-shell`, `reduced`, and `solid` modes.

- The React state tracks "reduced" mode, but the CSS application (`const shellClass = appState.data?.settings.glassMode === "solid" ? "app-shell solid-shell" : "app-shell";`) ignores it completely.
- Selecting "Reduced glass" falls through to the default full-glass state, making it a dead UI control.
