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

## Second milestone — 1.2.0

The XEX execution headers establish that the plain dash.xex/xam.xex are older 2.0.1888.0 modules. The $flash_dash.xex and $flash_huduiskin.xex are NXE 2.0.7371.0. The original 2020 log does not describe current compatibility; Xbox code was never launched in this investigation.

The compressed NXE payloads were decoded using authenticated AES-CBC/LZX blocks wrapped as standard cabinets. Windows expand.exe recovered the base images. The actual NXE dashboard yielded 27 embedded XUIZ archives; its HUD skin yielded two. Source format reference: https://github.com/xenia-project/xenia/blob/master/src/xenia/kernel/util/xex2_info.h.

Reimport now recovers 679 cached assets and indexes 5,403 combined entries. Seven effects are mapped: snd_panelleft, snd_panelright, snd_buttonselect, snd_buttonback, snd_panelunfold, snd_panelfold (from $flash_dash.xex), and btn_Focus (from $flash_huduiskin.xex). All seven are from NXE 2.0.7371.0, converted to PCM WAV. The older xam module is scanned as a fallback; it does not replace the recovered NXE sounds.

XUIB STRN and VECT sections are parsed with bounds validation. The settings adapter uses original BackgroundPanel.png and Legend_A/B/X/Y.png, the Current Setting string, and the list/detail/select/back structure found in the original resources. DATA timelines/object bindings remain unparsed. This is partial menu translation, not execution of the console UI engine or a complete XUR interpreter.

Next work: decode DATA object properties/timelines, measure animation fidelity, and map additional shell resources. Existing PIN controls and launcher-specific settings remain authoritative.

1.2.1: The low-resolution BackgroundPanel bitmap remains in the local inventory, but its enlarged/cropped frame has been replaced by a smooth CSS gradient and rounded border. Headings and controls stay outside the scrolling/animated body. Existing theme imports do not need to be repeated.

## Third milestone — original scene assets (1.3.0)

Active recovered assets: defaultbackground.jpg, Aura_Horizon.png (1600×75 transparent glow), TrayBackground.JPG (420×320), icon_disc.png (200×277 with embedded reflection), MobyChannelZero.png, xboxLogo.png (300×196, CSS-clipped orb), ico_32x_console.png, Legend_A/B/X/Y.png, eight GameDetails_BoxArtDropShadow segments and the seven NXE sound cues. The original background appears as Original NXE · Green dashboard in the theme picker; existing 1.2 asset caches support it without reimport.

Rendering still supplies the floor geometry and ripple rings, source-texture lighting, tile-content reflections, movement, typography and smooth menu frame. SphereHighlight is a specialized rendering texture, and Theme1/Theme2 prop layers are intended for different scenes; they have not been applied blindly to the game library. No low-resolution menu frame is stretched again. Asset dimensions, colors and composition were inspected before mapping.
