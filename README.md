# Project Kratos

An offline Electron launcher for Xenia Canary, based on the supplied Xbox 360 NXE carousel. No games, emulator, cover downloads, or licensed Xbox artwork are included.

## Run and build

Install Node.js 22 or newer, then run in this folder:

```sh
npm install
npm run start
npm test
npm run build
```

`build` packages for the current host; `build:windows` produces an NSIS installer and `build:linux` produces AppImage and Debian packages. Build on each target OS. Electron supports Windows 10/11; Linux Mint needs a desktop session and the normal Electron system libraries. Linux AppImages may require FUSE. Installers are unsigned; configure your own signing credentials for distribution. Do not disable Electron's sandbox to work around Linux setup problems.

## First setup and controller navigation

Connect a standard-mapped Xbox controller and press a button. Chromium's native Gamepad API handles the OS input backend; this app does not bundle independent XInput, evdev or SDL bindings. Test your controller's standard mapping on each target desktop.

- D-pad or left stick: scroll. A: launch. LB/RB: jump five games.
- Hold LB + RB + D-pad Up and press A to open the PIN keypad. The chord takes priority over scrolling and launching.
- Initial PIN: **1234**. Change it in settings before giving the kiosk to children.
- PIN keypad: D-pad to choose, A to enter, X to erase, Y to submit, B to cancel.
- Settings: select a field with A; use the on-screen keyboard to enter paths. X erases; Y accepts an edit; B discards it. Select **Save and rescan** to persist all changes.
- Configure absolute ROM directory and Xenia executable paths. Linux paths refer to Linux files, including the Windows `.exe`. Example: `/home/kiosk/xenia/xenia_canary.exe`.
- Linux runner defaults to `wine`. For Proton set the runner to an absolute Proton script path and runner arguments to `["run"]`. Provide `STEAM_COMPAT_DATA_PATH` and `STEAM_COMPAT_CLIENT_INSTALL_PATH` in the launch environment when required by your Proton installation. A runner must stay alive until its emulator exits; wrappers that detach immediately cannot provide reliable return-to-kiosk behavior.
- **Exit to desktop** is protected by the PIN session. Sessions expire after five minutes and are cleared on launch or return to games. Five wrong attempts temporarily block PIN entry for thirty seconds.

Settings and the generated `library.json` live under Electron's OS-specific `userData` folder: normally `%APPDATA%/Project Kratos` on Windows or `~/.config/Project Kratos` on Linux (the actual directory name may use `project-kratos` depending on packaging). The PIN uses salted scrypt credentials, not plaintext. Existing schema files containing `admin_pin` migrate automatically. Keep this file writable only by the kiosk account and its administrator. Missing files are initialized; malformed files are preserved and cause startup to fail rather than silently resetting authentication.

## Library and artwork

Scanning recurses through real subdirectories, skipping symlinks, for `.iso`, `.xex`, and `.god` files, case-insensitively. For each ROM it finds a same-directory `<ROM_NAME>.png`, `.jpg`, or `.jpeg` cover, ignoring case. Missing or unreadable covers render safe text-only CSS Xbox 360 cards. Titles remove bracketed metadata, split camel case, and normalize separators. IDs are stable hashes of absolute paths. The renderer only receives titles, IDs and controlled artwork URLs; raw process spawning and filesystem access stay in the main process.

This scanner discovers `.god` files, not arbitrary Games on Demand directory layouts or extensionless content containers. Extracted games may contain multiple `.xex` files; arrange your curated ROM folder to avoid unwanted entries. Xenia itself determines whether a particular file is supported. Scans run at startup and after saving settings; rescan errors preserve the previous library and are shown to the administrator.

Launch commands use argument arrays with `shell: false`:

```text
Windows: xenia_canary.exe --fullscreen <absolute-ROM-path>
Linux:   wine xenia_canary.exe --fullscreen <absolute-ROM-path>
Proton:  /path/to/proton run xenia_canary.exe --fullscreen <absolute-ROM-path>
```

The kiosk releases its global shortcuts and minimizes only after the process starts. Process errors or termination restore fullscreen, kiosk mode, keyboard focus and Gamepad API polling. Controllers switch back to the launcher once its window regains focus. Wine/Proton compatibility and Xenia's fullscreen behavior need testing with your exact emulator build and games.

## Kiosk security and limitations

The window is frameless and fullscreen with `kiosk: true`. Close events, renderer navigation, popups, webviews, devtools and renderer modifier shortcuts are blocked. The renderer is sandboxed with context isolation, no Node integration, a restrictive CSP and a narrow IPC bridge. IPC callers and launch IDs are validated; admin privileges are checked in the main process. ROM titles never become executable HTML.

Electron cannot guarantee interception of Alt+Tab, the Windows key, secure attention sequences, task managers, desktop compositor bindings or physical access. Global shortcut registrations are best-effort and log failures. Global shortcuts are suspended during gameplay to avoid interfering with Xenia, so the emulator window also needs OS-level lockdown. This application alone is not a security boundary or a complete childproof system. Use a dedicated non-admin kiosk account, appropriate Windows shell/restriction policies or Linux desktop restrictions, filesystem permissions, and restricted emulator settings. Test escape routes on the actual machine before unattended use.

## Repository and validation

- `main.js`: window, caller validation, PIN sessions, settings, controlled artwork protocol and emulator lifecycle.
- `preload.js`: safe context bridge.
- `index.html`, `styles.css`, `renderer.js`: supplied carousel structure, colors and 3D positioning, with gamepad polling, admin controls, safe fallback rendering and status messages. CSS/JS are external so CSP can disallow inline execution.
- `scanner.js`: recursive discovery, stable IDs, title cleanup, PIN migration and atomic JSON persistence.
- `scanner.test.js`: filesystem integration tests and credential checks using Node's built-in test runner.

Before distribution, validate Windows and Mint builds, controller connect/disconnect and held buttons, empty/missing libraries, artwork failures, paths with spaces, bad PIN throttling, settings expiry, launch errors, normal emulator exit, Wine/Proton lifecycle and OS kiosk policies. Runtime tests on each target host and signed release builds are required before calling this production-ready.
