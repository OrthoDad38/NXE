# FFmpeg developer-tool notice

FFmpeg is a development dependency used by the local dashboard asset-recovery tooling to convert XMA to PCM WAV. The shipped NXE application uses already-converted audio and does not contain or expose FFmpeg, cabextract/expand decoding, or an import endpoint.

The optional ffmpeg-static 5.3.0 developer package retains its own license and supplies build-specific FFmpeg licenses/readmes. The Windows tool reports FFmpeg 6.1.1, GPL v3, source revision e38092ef93. Do not process untrusted archives with this optional recovery tool; it is outside the shipped application's runtime security review.

Source/build references:
- https://github.com/FFmpeg/FFmpeg/commit/e38092ef93
- https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1
- https://github.com/eugeneware/ffmpeg-static
- https://www.gyan.dev/ffmpeg/builds/
- https://johnvansickle.com/ffmpeg/
- https://ffmpeg.org/security.html

The source code remains MIT licensed. Dashboard audio/artwork ownership is documented in assets/ATTRIBUTION.md.
