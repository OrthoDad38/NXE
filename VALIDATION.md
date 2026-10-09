# Validation — October 9, 2026

- Node.js 24.19.0; Electron 42.11.12; electron-builder 26.15.3, resolved in `package-lock.json`.
- All seven regression tests passed using `node --test --test-isolation=none`, including PIN-protected native pickers, picker cancellation, expiry during a dialog, admin clipboard shortcuts and native text editing/Enter/Escape behavior. The environment denied the subprocess used by the default test runner; the same tests ran successfully without subprocess isolation.
- `node --check` passed for main, preload and renderer scripts.
- Windows x64 NSIS packaging completed successfully with `npm run build` after granting the builder subprocess/download access. The installer has no configured publisher signing certificate and uses Electron's default application icon.
- npm audit reported eight moderate findings in the development/build tool dependency chain, all rooted in the sprintf-js denial-of-service advisory: https://github.com/advisories/GHSA-hp3w-g68c-fv3c. `npm audit fix` did not resolve them. No production npm dependency is bundled. Review the build tool chain before release.
- No actual kiosk window, physical gamepad, Xenia executable, ROM, Wine/Proton installation or Linux Mint runtime was exercised. The installer was built, not installed on this machine. Production readiness requires the host acceptance checks in README.md.

Electron references used for implementation:

- https://www.electronjs.org/docs/latest/api/browser-window
- https://www.electronjs.org/docs/latest/api/global-shortcut
- https://www.electronjs.org/docs/latest/api/context-bridge
- https://www.electronjs.org/docs/latest/tutorial/security
