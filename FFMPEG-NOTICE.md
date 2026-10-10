# FFmpeg notice

Project Kratos invokes FFmpeg as a separate local process to convert user-supplied XMA interface sounds into PCM WAV files. It is supplied by ffmpeg-static 5.3.0; Kratos's source remains MIT licensed. FFmpeg and ffmpeg-static retain their own licenses.

The Windows x64 binary supplied for this build reports FFmpeg 6.1.1, GPL v3, and source revision e38092ef93. The package contains ffmpeg.exe.LICENSE and ffmpeg.exe.README alongside the unpacked executable. Consult those files for build configuration and component licensing.

Source and build references:
- https://github.com/FFmpeg/FFmpeg/commit/e38092ef93
- https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1
- https://github.com/eugeneware/ffmpeg-static
- https://www.gyan.dev/ffmpeg/builds/
- https://johnvansickle.com/ffmpeg/

Build on the target OS to obtain the matching Windows/Linux binary. Do not reuse Windows node_modules when building a Linux installer. No Microsoft sound recordings or other dashboard assets are bundled; those are extracted from the user's local files at import time.
