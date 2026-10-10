# Project Kratos

A fullscreen, controller-first Electron launcher for Xenia Canary on Windows 10/11 and Linux Mint. The built-in NXE theme includes the recovered green dashboard background, nine additional wallpapers, original scene artwork, button legends, and seven navigation/select/back/menu sounds. No dashboard import, separate theme download, or internet connection is required to use them. Games and Xenia are not included.

Game Library uses rounded cover tiles with the entire cover visible, no title overlay, and floor reflections. Missing covers show green disc tiles and cleaned game titles. There is no avatar. The silver floor, ripples, rounded shadow, smooth menu frame, and movement are rendered in CSS/JavaScript. Convection is preferred when installed; the font is not bundled and system fonts provide a fallback.

## Windows: install without a terminal

Run the **Project Kratos Setup VERSION.exe** installer supplied with the build. It includes Electron, the launcher, NXE assets, and the sound conversion tool. It creates desktop and Start menu shortcuts. Open Project Kratos from either shortcut; Node.js and npm are not required on the installed machine. Xenia Canary and your games must be supplied separately.

For maintainers, `npm run build:windows` creates the installer in `dist/`. Installers are currently unsigned; code signing is needed for a polished public release. Builds are not automatically uploaded to GitHub Releases.

## Source checkout: Windows or Linux

Install Node.js 22 or newer with npm and Git. Clone the repository and install the locked dependencies:

```sh
git clone https://github.com/OrthoDad38/project-kratos.git
cd project-kratos
npm ci
npm run start
```

Use `git pull` and `npm ci` to update a checkout. For a Windows checkout, `npm run shortcut` creates a desktop shortcut without a visible terminal. Keep the checkout in the same location, or recreate its shortcut after moving it.

```sh
npm test
npm run build
```

`build` targets the current host. Build Windows packages on Windows and Linux packages on Linux. Do not copy Windows `node_modules` to Linux: Electron and FFmpeg are platform-specific.

## Linux Mint installation and running

Use a 64-bit Intel/AMD Mint desktop session. Kratos runs natively on Linux; its Windows Xenia executable runs through Wine or a configured Proton runner. Wine/Proton and game compatibility depend on your GPU, drivers, emulator version, and game. Linux Mint runtime and package installation still need testing on a physical Mint machine; the Windows build does not establish Linux compatibility.

### Install from a Debian package (preferred for Mint)

Obtain the `project-kratos_VERSION_amd64.deb` built on Linux. In the file manager, double-click it, open the package installer, and select **Install Package**. Launch **Project Kratos** from Mint's application menu afterward. Node.js and npm are not needed. Use Mint Software Manager to install **Wine** separately before launching games.

The terminal alternative, from the directory containing that package, is:

```sh
sudo apt install ./project-kratos_VERSION_amd64.deb
```

Replace VERSION with the actual filename. `apt` resolves the package's desktop library dependencies. Do not run Kratos itself with sudo. The Debian target installs an application-menu entry and uses electron-builder's sandbox setup. See the [electron-builder Linux documentation](https://www.electron.build/linux/) for packaging details.

### Portable AppImage

Obtain the Linux-built **Project Kratos-VERSION.AppImage**. In the file manager, open **Properties → Permissions**, enable permission to execute it, and double-click the file. AppImages do not install a menu entry automatically. The terminal alternative is:

```sh
chmod +x "Project Kratos-VERSION.AppImage"
"./Project Kratos-VERSION.AppImage"
```

If it reports a missing FUSE library, install the compatibility library through Software Manager or these commands:

```sh
# Mint 22.x / Ubuntu 24.04 base:
sudo apt install libfuse2t64
# Mint 21.x / Ubuntu 22.04 base, instead:
sudo apt install libfuse2
```

These package names and the extract-and-run fallback are documented by [AppImage](https://docs.appimage.org/user-guide/troubleshooting/fuse.html). If FUSE is unavailable, try `"./Project Kratos-VERSION.AppImage" --appimage-extract-and-run`. For sandbox/AppArmor errors, prefer the installed Debian package and inspect the error on your system; do not launch with `--no-sandbox` or globally disable AppArmor.

### Run or build from source on Mint

Install Git and Wine through Software Manager, or:

```sh
sudo apt update
sudo apt install git wine
```

Install Node.js 22 or newer using the [official Node.js download instructions](https://nodejs.org/en/download). Confirm `node --version` and `npm --version`, then follow the source checkout commands above. The Mint repository's Node.js version may be older than required. Run npm as your normal desktop user.

Build Linux packages on that Mint machine:

```sh
npm ci
npm test
npm run build:linux
```

The configured outputs are AppImage and Debian packages under `dist/`. First builds download packaging tools, Electron, and a Linux FFmpeg binary. No cabextract or dashboard import is needed for the built-in theme. For optional compressed dashboard imports, install `cabextract` with `sudo apt install cabextract`.

### Configure Xenia on Mint

1. Put Xenia Canary in a folder you can write to, such as `/home/YOUR_USER/Emulators/Xenia`. Install compatible graphics drivers and verify the emulator independently before configuring Kratos. You can test it with `wine /home/YOUR_USER/Emulators/Xenia/xenia_canary.exe`.
2. Launch Kratos, press controller **Start**, and enter the initial PIN **1234**.
3. Choose **Browse ROM folder…** and **Browse Xenia executable…**. Select Linux paths, such as `/home/YOUR_USER/Games/Xbox360` and `/home/YOUR_USER/Emulators/Xenia/xenia_canary.exe`.
4. Leave **Linux runner** as `wine` and **Runner arguments** as `[]` for ordinary Wine. Save and rescan.
5. Launch a game with A. When the emulator process exits, Kratos restores its fullscreen window and controller focus.

For Proton, select the absolute Proton script path as runner and set runner arguments to `["run"]`. Your launch environment must supply `STEAM_COMPAT_DATA_PATH` and `STEAM_COMPAT_CLIENT_INSTALL_PATH` if required by that Proton installation. A runner must remain alive until Xenia exits; wrappers that detach cannot return reliably to the kiosk. Wine prefixes are inherited from the launch environment. The app does not install Wine, Proton, graphics drivers, or Xenia.

## Controller and administrator controls

- D-pad/left stick: browse games. A: launch. LB/RB: jump five.
- **Start: open administrator access.** The earlier LB + RB + D-pad Up + A shortcut also remains available.
- Mouse: click **Admin**. Keyboard: type the PIN and Enter; Tab chooses controls, Enter activates, Escape cancels.
- Initial PIN: **1234**. Change it with **New PIN** and **Save and rescan**.
- PIN keypad: D-pad chooses, A enters, X erases, Y submits, B cancels.
- Settings support controller entry, native typing/paste, and mouse/keyboard file pickers. Enter/Done accepts a field edit; Escape/Cancel discards it. Save and rescan persists paths, runner settings, and a changed PIN.
- **PIN protection: on/off** immediately saves whether admin access asks for a PIN. Turn it off to open settings directly with Start or Admin, including access to Exit to desktop. Turn it back on to use the retained PIN. Turning it off does not erase your PIN; a new PIN is saved through Save and rescan.
- **Exit to desktop** is always the last option. Admin sessions expire after five minutes and are cleared on game launch or return to Game Library. Five incorrect PINs impose a thirty-second cooldown when protection is enabled.

PIN protection starts enabled, including for existing libraries without the new preference. Disabling it intentionally allows any user to open settings and exit the kiosk. Main-process caller validation, session checks, and restricted IPC remain active in either mode.

## Built-in NXE theme, wallpapers, and sound

Fresh installations automatically use **Original NXE · Green dashboard**. Existing wallpaper, audio, and imported-theme preferences are retained when available. If an older import is missing, Kratos falls back to the built-in NXE theme.

Admin → **NXE themes** offers **Built-in NXE theme**, all ten background choices, sound volume (0/25/50/75/100%), mute, and Test sound. Theme/audio changes save immediately. The seven cues are left, right, select, back, open, close, and focus. Playback failures do not block navigation. **Original Kratos theme** selects the earlier rendered background; **Built-in NXE theme** restores the included green dashboard and its scene assets.

All 679 recovered image/audio assets and resource metadata are included under `assets/nxe/`; no Xbox executable, account/profile, ROM, or emulator binary is included. Bundled sound files are already converted to PCM WAV, so ordinary playback does not need conversion or access to the original download folder. Paths in saved built-in preferences use the portable `builtin` identifier.

Optional **Import dashboard folder…** still accepts a local folder containing `NXE/Theme1/Wallpaper1.jpg` (or its parent). It caches supported images and decodes dashboard resources without executing Xbox code. Windows uses expand.exe; Linux uses cabextract. See [NXE-ASSETS.md](NXE-ASSETS.md) and [FFMPEG-NOTICE.md](FFMPEG-NOTICE.md).

## Games and cover artwork

Scanning recurses through real directories for `.iso`, `.xex`, and `.god` files, skipping symlinks. Same-folder ROM_NAME.png/.jpg/.jpeg artwork is detected case-insensitively. IDs are stable path hashes. This scans `.god` files rather than arbitrary extensionless Games on Demand containers; curate extracted games to avoid duplicate `.xex` entries.

Admin → **Download missing covers** searches the [x360db archive](https://github.com/xenia-manager/x360db). Confirm the suggested title or skip it. Save changed ROM paths before downloading. Downloaded covers are cached in userData/covers and survive rescans; local sidecars take priority. Downloads use fixed source URLs, size/time bounds, and JPEG validation. Covers remain the property of their owners.

## Settings, kiosk behavior, and security

Settings/library/cache live in Electron's userData folder, normally `%APPDATA%/Project Kratos` or `~/.config/Project Kratos` (development may use `project-kratos`). PINs use salted scrypt hashes. Legacy plaintext credentials migrate automatically. A malformed library is preserved and produces an error rather than silently resetting protection.

The launcher is frameless, fullscreen, and sandboxed with context isolation, no renderer Node access, controlled local artwork URLs, and a restrictive CSP. It stays fullscreen underneath Xenia during startup, releases game-interfering shortcuts, and restores focus on process termination or launch failure. Process commands use argument arrays with `shell: false`.

Electron cannot block every OS escape route: Alt+Tab, Windows keys, secure attention sequences, compositor shortcuts, task managers, and physical access need account/OS restrictions. Use a dedicated limited kiosk account and test on the actual computer. Keep PIN protection enabled for child use. The launcher alone is not a security boundary.

## Packaging for people who avoid terminals

The Windows NSIS installer is already configured and built; Linux AppImage and Debian targets are configured for Linux builds. Installers bundle Node/Electron and the NXE theme, so users launch with shortcuts and configure paths in the GUI. They still supply Xenia, games, and on Linux a runner.

| Benefit | Tradeoff |
| --- | --- |
| Double-click setup and application shortcuts | Larger download because Electron/Chromium and FFmpeg are bundled |
| Identical app/assets without npm setup | Separate builds and testing for each OS/architecture |
| Offline dashboard assets and sounds | Every app/runtime update needs a new package; no automatic updater yet |
| Familiar Windows uninstall and Mint package management | Unsigned Windows builds may show trust warnings; signing adds cost/setup |
| Easier support for nontechnical users | Linux still needs compatible Wine/Proton and graphics drivers |

The source code is MIT licensed; recovered Microsoft dashboard images/sounds and Xbox trademarks retain their own ownership and are not covered by MIT. The assets are included at the repository owner's request from their supplied archive. Archive availability does not establish redistribution rights. See [asset attribution](assets/ATTRIBUTION.md). Public distribution requires addressing these asset rights as well as bundled FFmpeg obligations.

## Validation

Run `npm test` for scanner, PIN/session, input, artwork, theme, and sound checks. Windows packaging and hidden Electron verification are performed locally. Linux builds and Mint installation/gameplay require separate target-machine validation. Compiled XUR DATA timelines and the console shell are not fully translated; this launcher recreates the dashboard interface rather than running Xbox dashboard code.
