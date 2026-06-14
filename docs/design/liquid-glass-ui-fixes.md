# Liquid Glass UI — Session Changelog

This document summarizes the work done across this session to bring Control's
shell in line with the macOS "Liquid Glass" inspiration screenshot. It covers
the five iterative issues the user reported and the fixes applied for each.

## Files touched

- `src/renderer/src/styles.css`
- `src/renderer/src/main.tsx`
- `src/main/index.ts`

## Issue 1 — "UI doesn't look like liquid glass; sizing is off; background looks green"

### Root cause

- `.right-rail` had a stray `padding: 150px 0 0` that pushed About / Releases /
  Contributors panels far below the sidebar, breaking column alignment.
- `body` background gradient was too transparent; the user's macOS wallpaper
  was bleeding through `transparent: true` and tinting the shell green.
- Top-bar circular controls (`.icon-button.glass`, `.avatar-button`) were
  rendering as stretched pills (42×38, 48×38) instead of 38×38 circles.
- `.app-shell` margins (26/48) and column widths (278 / 304) were larger than
  the inspiration.

### Fix (`src/renderer/src/styles.css`)

- Removed the stray top padding from `.right-rail`; gave it hidden scrolling
  (`overflow: auto` + hidden scrollbar via `scrollbar-width: none` and
  `::-webkit-scrollbar { display: none }`).
- Strengthened the body background with layered radial + linear blue
  gradients so the shell read blue regardless of wallpaper bleed-through.
- Tightened `.app-shell` to `margin: 16px`, `height: calc(100vh - 32px)`,
  columns `264px minmax(620px, 1fr) 296px`.
- Made `.icon-button.glass` and `.avatar-button` square 38×38 with
  `border-radius: 50%` so they render as proper circles.

## Issue 2 — "Background is just blue; top bar doesn't match; corners are square, not liquid-glass corners"

### Root cause

- The fix from Issue 1 painted an opaque blue gradient on `body` and a
  near-opaque glass on `.app-shell`. That CSS layer completely covered the
  native `electron-liquid-glass` view (which is what actually provides the
  real Liquid Glass look and the rounded `cornerRadius: 30` corners coming
  from `applyLiquidGlass` in `src/main/index.ts`).
- Result: the user only ever saw flat CSS blue with the renderer's square
  corners, never the native glass.

### Fix

- `src/renderer/src/styles.css`:
  - Set `html`, `body`, `#root` to `background: transparent`.
  - Removed the opaque gradient / border / box-shadow / `backdrop-filter`
    from `.app-shell`; it's now `background: transparent`, `margin: 0`,
    full-viewport height, but keeps `border-radius: 30px` to mirror the
    native window radius.
  - Moved the previous "fake glass" gradients behind a `body.no-liquid-glass`
    selector so non-macOS builds still get a CSS fallback.
- `src/renderer/src/main.tsx`:
  - Detect non-macOS via `navigator.platform` and add `no-liquid-glass` to
    `document.body` so the CSS fallback only activates when the native view
    isn't attached.

## Issue 3 — "Why is the background tinted yellow?"

### Initial (incorrect) hypothesis

- Believed `tintColor` was parsed as `#AARRGGBB` (alpha-first), based on the
  README's example `tintColor: "#44000010"` labeled "black tint".
- Under that assumption, `#DDEEFF30` would mean `alpha=0xDD` over RGB
  `0xEEFF30`, i.e. an ~87%-opaque yellow wash — matching the symptom.

### Fix attempt (`src/main/index.ts`)

- Changed `tintColor` from `#DDEEFF30` to `#10DDEEFF` and added a comment
  documenting the assumed `#AARRGGBB` byte order.

## Issue 4 — "Unfocused: yellow tint. Focused: cyan tint"

### Real root cause (corrected)

- Inspected `node_modules/electron-liquid-glass/src/glass_effect.mm`,
  specifically `ColorFromHexNSString`. The native code does:
  - `(rgba & 0xFF000000) >> 24` → red
  - `(rgba & 0x00FF0000) >> 16` → green
  - `(rgba & 0x0000FF00) >> 8` → blue
  - `rgba & 0x000000FF` → alpha
- So 8-char hex is `#RRGGBBAA`, NOT `#AARRGGBB`. The earlier hypothesis (and
  the README example interpretation) was wrong.
- That means `#10DDEEFF` was being parsed as `rgb(0x10, 0xDD, 0xEE)` at full
  alpha — a fully-opaque cyan. Hence cyan when the window was focused, and
  the desaturated yellow cast when unfocused (macOS lowers vibrancy
  saturation on inactive windows).

### Fix (`src/main/index.ts`)

- Set `tintColor` to `#FFFFFF10` — white at ~6% alpha in the correct
  `#RRGGBBAA` order — so the native glass stays neutral in both focused and
  unfocused states.
- Updated the inline comment to cite `glass_effect.mm` so the byte order
  isn't guessed again in the future.

## Final state of relevant code

### `src/main/index.ts` (excerpt)

```ts
liquidGlassViewId = liquidGlass.addView(window.getNativeWindowHandle(), {
  // tintColor uses #RRGGBBAA byte order (verified in
  // electron-liquid-glass/src/glass_effect.mm: top 24 bits are RGB and
  // the low 8 bits are alpha). Use a near-clear white so the native
  // liquid glass keeps its neutral look in both focused and unfocused
  // window states instead of being washed with cyan/yellow.
  cornerRadius: 30,
  tintColor: "#FFFFFF10",
  opaque: false
});
```

### `src/renderer/src/styles.css` (key rules)

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}

body.no-liquid-glass {
  background:
    radial-gradient(circle at 14% 18%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 32%),
    radial-gradient(circle at 92% 88%, rgba(70, 150, 240, 0.55), rgba(70, 150, 240, 0) 45%),
    linear-gradient(135deg, #d8e9fb 0%, #e8f1fd 38%, #cfe2f8 62%, #8fb8e8 100%);
}

.app-shell {
  display: grid;
  grid-template-columns: 264px minmax(620px, 1fr) 296px;
  grid-template-rows: 50px minmax(0, 1fr);
  gap: 12px;
  height: 100vh;
  margin: 0;
  padding: 12px;
  overflow: hidden;
  border-radius: 30px;
  background: transparent;
}

body.no-liquid-glass .app-shell {
  height: calc(100vh - 32px);
  margin: 16px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.1)), rgba(230, 242, 255, 0.18);
  box-shadow: 0 34px 90px rgba(27, 86, 160, 0.28);
  -webkit-backdrop-filter: blur(34px) saturate(1.35);
  backdrop-filter: blur(34px) saturate(1.35);
}
```

### `src/renderer/src/main.tsx` (excerpt)

```tsx
// On non-macOS platforms (where the native liquid-glass view is not attached),
// fall back to a CSS-painted glass background so the UI still reads as glass.
if (!/Mac/i.test(navigator.platform)) {
  document.body.classList.add("no-liquid-glass");
}
```

## Verification

- CSS lints clean (`styles.css` — no errors).
- `main.tsx` lints clean.
- Native byte-order verified directly in
  `node_modules/electron-liquid-glass/src/glass_effect.mm`.
- Live Electron run on macOS was not performed in-session; visual results
  must be confirmed by the user via `npm run dev` on macOS 26+.

## Lessons / notes

- Don't trust ambiguous README examples for byte order — always verify
  against the native source when available.
- When using `electron-liquid-glass`, keep CSS layers transparent above the
  native view; any opaque background on `body` / root containers will hide
  both the glass material and the rounded window corners.
- Use a `no-liquid-glass` body class to scope CSS fallback styles for
  platforms where the native view isn't attached (Windows / Linux).

## 2026-06-05 foundation follow-up

The native options now live in `src/main/theme/liquidGlassOptions.ts` instead
of being embedded in `src/main/index.ts`.

- `tintColor` remains `#FFFFFF00` and is tested as `#RRGGBBAA` input.
- `opaque` remains `true` deliberately. This keeps Control as an app surface
  instead of a full-window lens until focused/unfocused screenshots prove that
  `opaque: false` improves the shell without wallpaper bleed or state tinting.
- `unstable_setScrim(0)` and `unstable_setSubdued(0)` remain neutral defaults.
- The renderer theme resolver now emits shared surface aliases:
  `--color-surface-primary`, `--color-surface-secondary`, and
  `--color-surface-hover`, so shared primitives do not depend on route-local
  colors.

Required manual verification for any future native option change:

- full app light solid
- full app dark solid
- full app dark glass shell
- full app dark reduced glass
- focused and unfocused macOS window states
- neutral, blue, and yellow wallpaper/backdrop checks
