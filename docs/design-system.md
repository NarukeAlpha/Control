# Control Design System

Control targets a glass shell inspired by the provided GitHub concept and Apple Music.app on macOS.

## Visual Direction

- The window, sidebar, top toolbar, right rail, settings panel, and popovers use glass.
- Dense content stays flatter: file rows, issue rows, PR rows, checks, README, and tables use high-contrast translucent white surfaces.
- Cards are reserved for panels, repeated tiles, and modal surfaces.
- The UI should feel native, quiet, and operational, not like a marketing page.

## Glass Rules

- On macOS, use `electron-liquid-glass` as the native window material. The renderer root, body, and app shell must stay transparent so the native glass remains visible.
- Use a neutral native tint. Avoid colored native tints because active and inactive macOS window states can shift the surface toward cyan, yellow, or wallpaper-derived casts.
- Use CSS `backdrop-filter` only on renderer panels that sit above the native shell, and keep those panels low-alpha and neutral.
- Avoid backdrop blur on every table row.
- Keep borders subtle and white-tinted to preserve the Music.app style.
- Provide a settings toggle for reduced or solid glass.
- Non-macOS fallback glass belongs behind a platform-scoped class only. It should not affect the macOS renderer path.

## macOS Visual Verification

- Verify focused and unfocused states on macOS before accepting Liquid Glass changes.
- Check the window over neutral, blue, and yellow wallpapers to catch material tint regressions.
- Confirm the titlebar drag region remains transparent except for controls marked as non-draggable.
- Confirm the traffic light area, provider button, search field, and action buttons do not overlap at desktop widths.
- Screenshots should include the repository page, account Home, global Issues, global Pull Requests, and mailbox routes once those routes are implemented.

## Layout Rules

- Left navigation is persistent.
- Repository content is central and scrollable.
- Right rail is persistent on desktop and hidden below 1180px.
- Lists use stable row heights and virtualization where data can grow.
- Buttons and controls have stable dimensions to avoid layout shift.

## Color

The palette uses cool glass neutrals with restrained blue and green accents. Avoid a one-note blue-only interface by mixing neutral ink, white glass, muted slate text, blue links, and green success states.

## Accessibility

- Maintain readable contrast in dense content.
- Do not rely on transparency for state alone.
- All icon buttons require labels or `title` text.
- Dangerous actions require confirmation.

## Performance

- Shell surfaces may use blur.
- Repeated rows should not use blur.
- Use `@tanstack/react-virtual` for repository and file lists.
- Debounce or query-gate search.
- Keep API work in the main process.
