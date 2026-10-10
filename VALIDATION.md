# Validation — October 9, 2026

- Node.js 24.19.0; Electron 42.11.12; electron-builder 26.15.3, resolved in `package-lock.json`.
- All eight regression tests passed using `node --test --test-isolation=none`, including PIN-protected native pickers, picker cancellation, expiry during a dialog, admin clipboard shortcuts, native text editing/Enter/Escape behavior and fullscreen emulator handoff/recovery. The environment denied the subprocess used by the default test runner; the same tests ran successfully without subprocess isolation.
- `node --check` passed for main, preload and renderer scripts.
- Windows x64 NSIS packaging completed successfully with `npm run build` after granting the builder subprocess/download access. The installer has no configured publisher signing certificate and uses Electron's default application icon.
- npm audit reported eight moderate findings in the development/build tool dependency chain, all rooted in the sprintf-js denial-of-service advisory: https://github.com/advisories/GHSA-hp3w-g68c-fv3c. `npm audit fix` did not resolve them. No production npm dependency is bundled. Review the build tool chain before release.
- The NXE renderer was run in a hidden Electron window with a fixture preload and six sample fallback games. The 1080×608 dashboard screenshot was inspected, selection advanced to the expected game, and PIN submission reached the admin settings state without an error. This verifies rendering with sample data, not a physical controller or emulator.
- The avatar-free Game Library layout and bundled sphere logo/ripple treatment were captured and visually inspected at 1080×608. The installed Convection family was detected, and Chromium's `CSS.getPlatformFontsForNode` confirmed the heading rendered with `Convection-Bold` rather than a fallback. All interface text inherits the shared Convection font stack.
- The user-supplied sphere JPEG and A-button crop were visually inspected in the dashboard. The fixture also reached admin settings with image-based A/B/X/Y hints and reported no renderer errors. Both JPEGs are bundled locally; no runtime download is needed.
- No actual kiosk window, physical gamepad, Xenia executable, ROM, Wine/Proton installation or Linux Mint runtime was exercised. The installer was built, not installed on this machine. Production readiness requires the host acceptance checks in README.md.

Electron references used for implementation:

- https://www.electronjs.org/docs/latest/api/browser-window
- https://www.electronjs.org/docs/latest/api/global-shortcut
- https://www.electronjs.org/docs/latest/api/context-bridge
- https://www.electronjs.org/docs/latest/tutorial/security
