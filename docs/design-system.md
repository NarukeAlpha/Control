# Control Design System

Control targets a glass shell inspired by the provided GitHub concept and Apple Music.app on macOS.

## Visual Direction

- The window, sidebar, top toolbar, right rail, settings panel, and popovers use glass.
- Dense content stays flatter: file rows, issue rows, PR rows, checks, README, and tables use high-contrast translucent white surfaces.
- Cards are reserved for panels, repeated tiles, and modal surfaces.
- The UI should feel native, quiet, and operational, not like a marketing page.

## Glass Rules

- Use native Electron/macOS vibrancy at the window level.
- Use CSS `backdrop-filter` only on shell surfaces.
- Avoid backdrop blur on every table row.
- Keep borders subtle and white-tinted to preserve the Music.app style.
- Provide a settings toggle for reduced or solid glass.

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

