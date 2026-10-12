# NXE dashboard resources

The built-in theme includes 679 recovered image/audio assets and metadata under `assets/nxe/`. It supplies the original green background, nine Theme0/Theme1/Theme2 wallpapers, horizon glow, tray texture, disc artwork, selection marker, Xbox orb, console icon, button legends, and seven interface sound cues.

The source dashboard resources are NXE 2.0.7371.0. Images and converted PCM WAV cues are loaded locally through the restricted artwork protocol. The separate background track is `assets/dashboard-music.ogg`; its source is listed in [asset attribution](assets/ATTRIBUTION.md).

The resource parser validates XUIZ archives and XEX containers, and decodes XUR strings/vectors. Xbox executable code is not executed. XUR DATA timelines and full console-shell behavior are not implemented.

Floor geometry, ripple rings, tile lighting/reflections, movement, rounded shadows, and the smooth menu frame are rendered in CSS/JavaScript. Scene-specific avatar/prop layers and square box-art shadows are retained in the inventory but not applied to the library.

Existing cached themes remain supported. Import/decoder APIs are not exposed by the shipped app. Asset recovery is developer-only; normal use needs no dashboard download, import, or conversion. The font is not bundled.

Microsoft dashboard assets retain their ownership and are separate from the MIT source-code license. See [FFMPEG-NOTICE.md](FFMPEG-NOTICE.md) for converter licensing.
