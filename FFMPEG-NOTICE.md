# FFmpeg notice

NXE invokes FFmpeg as a separate local process to convert user-supplied XMA interface sounds into PCM WAV files. It is supplied by ffmpeg-static 5.3.0; NXE's source remains MIT licensed. FFmpeg and ffmpeg-static retain their own licenses.

The Windows x64 binary supplied for this build reports FFmpeg 6.1.1, GPL v3, and source revision e38092ef93. The package contains ffmpeg.exe.LICENSE and ffmpeg.exe.README alongside the unpacked executable. Consult those files for build configuration and component licensing.

Source and build references:
- https://github.com/FFmpeg/FFmpeg/commit/e38092ef93
- https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1
- https://github.com/eugeneware/ffmpeg-static
- https://www.gyan.dev/ffmpeg/builds/
- https://johnvansickle.com/ffmpeg/

Build on the target OS to obtain the matching Windows/Linux binary. Do not reuse Windows node_modules when building a Linux installer. The built-in NXE package includes seven Microsoft sound cues converted from the owner's supplied dashboard archive; optional imports can convert additional local resources. Dashboard asset ownership is documented in assets/ATTRIBUTION.md.
