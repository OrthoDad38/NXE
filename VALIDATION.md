# NXE validation

Current application: **v1.9.0**. Documentation screenshots were captured on October 11, 2026.

## Verified

- 35 regression tests pass: scanning, credentials/admin sessions, controller input, PIN cues, artwork validation/replacement, byte-range music playback, theme resources, disc grouping, and native handoff state/cancellation/timeouts.
- Windows x64 NSIS packaging succeeds. The installer is unsigned.
- Packaged Electron checks cover local wallpaper/audio decode, settings order and field editing, cover replacement/rescan, multi-disc navigation, shared artwork/cache preservation, and selecting the correct disc launch path.
- Native staged-window testing verifies startup occlusion, fullscreen settling, and subsequent reveal.
- An isolated portable copy of the user's Xenia Canary build was tested with Fable II. The native stable-fullscreen signal handed over after approximately 3.6 seconds; original emulator configuration and saves were untouched.
- Background music loops, stops on launch, and restarts once after exit or launch failure.
- Current README captures show the library, Blue Dragon disc picker, admin menu, cover tools, fallback art, wallpaper settings, and three wallpaper examples.

- Security runtime tests blocked private/traversal/prototype asset URLs, unauthorized admin access, ROM-title markup injection, and renderer network requests. The packaged executable's Electron fuses were inspected; no runtime converter is shipped. See [SECURITY.md](SECURITY.md).

## Remaining host checks

Linux Mint packages/runtime, Wine/Proton compatibility, physical controller variations, and game-specific behavior need validation on the target machine. Window settling is not a universal game-main-menu readiness signal. OS escape routes require kiosk account/desktop restrictions.

## Commands

```sh
npm test
npm run build:windows
npm run build:linux
```

If the environment blocks test subprocess isolation, use `node --test --test-isolation=none`. Build Linux artifacts on a Linux host.
