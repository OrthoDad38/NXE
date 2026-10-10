# NXE asset investigation — first milestone

The supplied dashboard collection contains Blades, NXE and Kinect folders. NXE includes both dash.xex and $flash_dash.xex, XAM/HUD modules, patch files, theme artwork, fonts and compiled resources. The exact executable dashboard version has not been established. Its existing Xenia log identifies a January 2020 emulator build; current dashboard emulation was not tested.

## Verified findings

- Theme0: four original 1280×720 wallpapers.
- Theme1: one original 1280×720 wallpaper, banner and background/midground/foreground layers. parameters.ini contains SphereColor=3.
- Theme2: four original 1280×720 wallpapers and layered imagery. parameters.ini contains SphereColor=2 and avatar lighting values.
- mediasite.xzp: XUIZ archive, 978,585 bytes, 860 entries. The parser validates big-endian table/data bounds and decodes UTF-16BE filenames. The format investigation used https://github.com/rene0/xbox360/blob/master/extract360.py as a reference; implementation is native JavaScript with bounds and path checks.
- Combined import: 120 supported JPEG/PNG image assets. No audio entries were found by WAV/XMA filename extensions in this archive.
- Compiled XUR layouts include ContentList, GameDetails, GameDetails_Actions and DownloadHistory; sample files start with XUIB. They have been indexed, not translated.
- Recovered graphics include game category/controller icons and box-art shadow segments. These are cached for further mapping but not yet substituted into the interface.

## Implemented

PIN-protected folder import, immutable source access, local image cache and manifest, original wallpaper selection, persistent settings, original Kratos fallback, and renderer access by fixed asset IDs. The original Theme1 background has been visually checked inside the launcher. Existing game launch, cover art, PIN and controller behavior remain in place.

## Next investigation

1. Map recovered icon/shadow images to appropriate Kratos UI elements and inspect XUR layout properties.
2. Investigate shared dashboard resources in XAM/HUD modules using documented extraction methods. Encrypted/compressed executables may need additional tooling; availability and compatibility are not yet established.
3. Identify original tile/orb/ripple resources or derive measured CSS/canvas equivalents where missing.
4. Measure transition timing against the reference; translate verified layout and motion data.
5. Locate and convert supported navigation/select/back sounds if recoverable. Add volume and mute controls when audio exists.

Imported Microsoft assets remain local to the user's installation. No executable dashboard files, extracted Microsoft images, account/profile files or SDK components are committed to GitHub or included in the installer.
