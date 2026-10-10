# Project Kratos

An offline Electron launcher for Xenia Canary, based on the supplied Xbox 360 NXE carousel. No games, emulator, or cover downloads are included. Artwork provenance is recorded in `assets/ATTRIBUTION.md`.

The dashboard follows the supplied NXE visual reference: lime-to-dark-green landscape tiles recede to the right, above a misty green background and silver floor with soft reflections. Titles sit inside tiles and fallback games use CSS disc artwork. The heading is **Game Library**, with no avatar. The corner uses the user's supplied Xbox sphere image and six softly blurred perspective ripple ellipses positioned to match the supplied screenshot. A/B/X/Y prompts use circular CSS crops of the user's button sheet, preserving the source image pixels. Admin and launch screens use the same palette. The decorative navigation labels are not additional settings or marketplace functions.

All interface text prefers the locally installed **Convection** font, including game titles, admin buttons, PIN controls and editable fields. The font is not redistributed; install it on the machine running Kratos, then restart the app. Segoe UI/system fonts provide a fallback on other hosts.

Motion and admin menus follow the [NXE segment at 1:09–1:25](https://www.youtube.com/watch?v=W_jT9c7RP5Q&t=69s): the collection enters with a short slide/fade, outgoing tiles drift left and fade while the next tile enlarges into place, and admin pages slide into a slate-blue panel. Settings use a moving glossy green highlight, thin row separators and a right-hand current-value/help column. This recreates the observed interaction style with Kratos settings rather than copying the Xbox console's settings functionality. Motion is disabled when the OS requests reduced motion.

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

For a Windows source checkout, run `npm run shortcut` once after `npm install`. This creates **Project Kratos.lnk** on your Windows desktop (including redirected/OneDrive desktops) and launches the checkout without a visible terminal. Keep the checkout at the same location; rerun the command if you move it. The Windows installer also explicitly creates desktop and Start menu shortcuts and recreates the desktop shortcut on reinstall. Running `npm run start` by itself does not install a shortcut.

Connect a standard-mapped Xbox controller and press a button. Chromium's native Gamepad API handles the OS input backend; this app does not bundle independent XInput, evdev or SDL bindings. Test your controller's standard mapping on each target desktop.

- D-pad or left stick: scroll. A: launch. LB/RB: jump five games.
- Hold LB + RB + D-pad Up and press A to open the PIN keypad. The chord takes priority over scrolling and launching.
- Mouse/keyboard: click **Admin**, type the PIN and press Enter. The same PIN protection applies to every input method. Tab moves through buttons; Enter activates the focused button; Escape closes or cancels the panel.
- Initial PIN: **1234**. Change it in settings before giving the kiosk to children.
- PIN keypad: D-pad to choose, A to enter, X to erase, Y to submit, B to cancel.
- Settings: select a field with A; use the on-screen keyboard to enter paths. X erases; Y accepts an edit; B discards it. Select **Save and rescan** to persist all changes.
- You can also click a field, type directly or use Ctrl+A/C/V/X/Z/Y to select, copy, paste, cut, undo or redo. Press Enter or click **Done** to accept an edit; Escape or **Cancel** discards it. Gamepad navigation and the on-screen keyboard remain available.
- **Browse ROM folder…** opens the native folder picker; **Browse Xenia executable…** opens the native `.exe` picker. On Windows these use the familiar File Explorer selection dialogs. Cancel keeps the existing setting. Picked paths are saved only when you choose **Save and rescan**. Pickers require an authenticated, unexpired admin session; the native OS dialogs use mouse/keyboard navigation.
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

The kiosk shows a fullscreen **Starting your game…** screen and releases global shortcuts when the process starts. It stays fullscreen underneath Xenia instead of minimizing and exposing the desktop while the emulator initializes. Xenia creates and focuses its own window; no fixed startup delay or repeated focus forcing is used. Its own windowed-to-fullscreen transition and loading time depend on the emulator build and game. Process errors or termination restore fullscreen, kiosk mode, keyboard focus and Gamepad API polling. Controllers switch back to the launcher once its window regains focus. Wine/Proton compatibility and Xenia's fullscreen behavior need testing with your exact emulator build and games.

## Kiosk security and limitations

The window is frameless and fullscreen with `kiosk: true`. Close events, renderer navigation, popups, webviews, devtools and renderer modifier shortcuts are blocked. The renderer is sandboxed with context isolation, no Node integration, a restrictive CSP and a narrow IPC bridge. IPC callers and launch IDs are validated; admin privileges are checked in the main process. ROM titles never become executable HTML.

Electron cannot guarantee interception of Alt+Tab, the Windows key, secure attention sequences, task managers, desktop compositor bindings or physical access. Windows uses local window/input blocking for close, devtools and fullscreen keys rather than attempting to register reserved keys or an invalid standalone Super accelerator. On Linux, intercepting Alt+Tab is best-effort. The startup message explicitly identifies the OS task-switching limitation. Global shortcuts are suspended during gameplay to avoid interfering with Xenia, so the emulator window also needs OS-level lockdown. This application alone is not a security boundary or a complete childproof system. Use a dedicated non-admin kiosk account, appropriate Windows shell/restriction policies or Linux desktop restrictions, filesystem permissions, and restricted emulator settings. Test escape routes on the actual machine before unattended use.

The earlier `OS did not grant shortcut` and `Unsupported shortcut: Super` messages were shortcut-registration diagnostics, not fatal startup errors. `Downloading Electron binary...` pertains to obtaining the Electron runtime. If the dashboard closes or never appears, those messages alone do not explain why. Current startup prints `[Kratos] Dashboard loaded.` and reports main-frame load failures and renderer termination details to the terminal.

## Repository and validation

- `main.js`: window, caller validation, PIN sessions, settings, controlled artwork protocol and emulator lifecycle.
- `preload.js`: safe context bridge.
- `index.html`, `styles.css`, `renderer.js`: supplied carousel structure, colors and 3D positioning, with gamepad polling, admin controls, safe fallback rendering and status messages. CSS/JS are external so CSP can disallow inline execution.
- `scanner.js`: recursive discovery, stable IDs, title cleanup, PIN migration and atomic JSON persistence.
- `scanner.test.js`: filesystem integration tests and credential checks using Node's built-in test runner.

Before distribution, validate Windows and Mint builds, controller connect/disconnect and held buttons, empty/missing libraries, artwork failures, paths with spaces, bad PIN throttling, settings expiry, launch errors, normal emulator exit, Wine/Proton lifecycle and OS kiosk policies. Runtime tests on each target host and signed release builds are required before calling this production-ready.

## Download missing covers
Unlock Administrator settings with your PIN, then choose **Download missing covers**. Confirm the matching Xbox 360 title for each game, or choose Skip. D-pad/arrow keys select; A/Enter downloads; B/Escape returns to settings. Mouse and Tab work too. Save and rescan first if the ROM directory changed: downloads operate on the saved library.

Artwork is fetched from the [x360db archive](https://github.com/xenia-manager/x360db), without an API key. Coverage varies; unavailable artwork leaves the fallback tile intact. Network errors can be retried or skipped. The five-minute admin session still applies; reopen settings with your PIN if it expires.

The build-tool dependencies use a scoped override for `@electron/get` → `global-agent` 4.1.3 to remove the vulnerable `sprintf-js` logging dependency chain. Commit and use the supplied lockfile; `npm ci` installs the tested versions reproducibly. Version 1.0.8 passes the full npm audit as of October 9, 2026.

Covers are cached under the application's userData `covers` directory and reapplied on startup/rescan. Local PNG/JPG artwork beside the ROM takes priority. Existing covers are never replaced by this action. The entire cover remains visible using `object-fit: contain`. Requests go through the main process to fixed archive URLs with timeouts, size limits, and JPEG signature checks. No remote URLs or filesystem paths are accepted from the renderer. Artwork remains the property of its respective owners; the archive supplies it for identification and archival purposes.

Artwork tiles follow the cover image proportions (up to 44vh tall and 33vw wide), without a title overlay or cropping. Missing/broken artwork retains the green tile and game title. Exit to desktop is the last Administrator settings option.

## Original NXE theme import (1.1.0)
Unlock Administrator settings → **NXE themes** → **Import dashboard folder…**. Select the downloaded `Xbox 360 Dashboard` folder, its `Dashboards` folder, or the `NXE` folder. The importer recognizes NXE by `Theme1/Wallpaper1.jpg`. It selects Theme1's original wallpaper initially. Choose any imported wallpaper, or **Original Kratos theme** to restore the existing appearance. Changes apply immediately and persist without Save and rescan.

Supported JPEG/PNG theme layers and images from the XUIZ `mediasite.xzp` archive are copied to userData/nxe-themes/import-*/. Each import has a manifest mapping safe asset IDs to cached files, the nine available wallpapers, and the archive inventory. The source folder remains untouched and need not stay available afterward. Images are served through the existing restricted local artwork protocol. Import and selection require an active PIN session, and Exit to desktop stays last.

This first milestone renders the original wallpapers over Kratos's existing floor, tiles and UI. Layered images and recovered icons are inventoried for further composition work; compiled XUR menus, XEX code, Xbox font resources and audio are not executed or translated. No dashboard binaries or imported Microsoft artwork are included in this repository or installer. See NXE-ASSETS.md for findings and remaining work.
