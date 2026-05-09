# Windows and Linux Support Plan

Control V1 is macOS-first. Windows and Linux are future support targets only, and current work should not trade off macOS Liquid Glass quality to preserve temporary cross-platform behavior.

## Position

- macOS is the only V1 visual and runtime acceptance target.
- Windows and Linux can use Electron in the future, but they will not use `electron-liquid-glass`.
- The renderer should keep platform branches explicit so future desktop support can add alternate shell materials without changing GitHub provider or route behavior.
- GitHub.com provider semantics, local storage contracts, and IPC security rules should remain platform-independent.

## Future Shell Strategy

Windows and Linux should get a separate shell implementation instead of trying to emulate macOS Liquid Glass exactly.

- Keep the native macOS glass path isolated behind platform detection in the main process.
- Add a renderer fallback class for Windows and Linux that uses neutral translucent surfaces and no colored wallpaper-tinted backgrounds.
- Use platform titlebar conventions per OS:
  - Windows: support system window controls, snap layouts, and high-contrast mode.
  - Linux: support common desktop environments with a conservative custom titlebar fallback.
- Do not rely on native vibrancy APIs that only exist on macOS.
- Keep dense content flatter than the shell so virtualization remains fast on integrated GPUs.

## Packaging Work

- Add `electron-builder` Windows and Linux targets only after macOS packaging is stable.
- Validate optional native modules on each target:
  - `better-sqlite3` installation and rebuilds.
  - `keytar` availability and fallback behavior.
  - GitHub CLI discovery in platform-specific install paths.
- Add platform-specific signing and notarization plans:
  - Windows code signing certificate and installer reputation.
  - Linux AppImage or deb/rpm packaging and desktop entries.

## Runtime Work

- Define platform-specific shell capability flags:
  - `nativeLiquidGlass`
  - `customTrafficLights`
  - `systemTitlebarControls`
  - `keychainProvider`
  - `ghCliDiscoveryPaths`
- Keep the renderer consuming normalized capability flags instead of direct OS checks where possible.
- Preserve renderer sandboxing, context isolation, and the narrow `window.control` bridge on every platform.
- Make all external URL opens go through the main process.

## Testing Work

- Keep macOS screenshot tests as the visual baseline for V1.
- Add Windows and Linux smoke tests only after shell fallback work begins.
- Add future Playwright projects for:
  - Windows desktop viewport with system titlebar spacing.
  - Linux desktop viewport with custom titlebar fallback.
  - Reduced transparency mode.
  - High contrast / forced colors where supported.
- Re-run provider tests on each platform to confirm fork counts, language breakdowns, and action URLs remain platform-independent.

## Risks

- Native module rebuilds can fail differently across target platforms.
- Keychain behavior varies by distribution and desktop environment on Linux.
- Custom titlebars can break expected OS gestures if spacing and drag regions are not platform-specific.
- Acrylic or blur effects on Windows/Linux can be slower or less predictable than macOS native material.
- GitHub CLI path discovery and auth status messages may differ by shell and install method.

## Rollout Phases

1. Keep macOS V1 stable and documented.
2. Add shell capability flags and platform-scoped CSS fallback without changing macOS visuals.
3. Add Windows/Linux packaging experiments in CI.
4. Add platform smoke tests for launch, auth setup, repository navigation, and external URL actions.
5. Promote Windows or Linux to supported status only after visual, packaging, keychain, and GitHub CLI behavior are verified.
