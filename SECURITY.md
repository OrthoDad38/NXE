# Security

## Review scope and result

A focused source, dependency, publication, and packaged-runtime review was completed on October 11, 2026 for NXE v1.9.0. No remote-control listener, telemetry uploader, arbitrary renderer command endpoint, or matching publication secrets were found in the reviewed application. This is not an independent penetration test or a guarantee that a host/emulator is safe.

## Protections

- Sandboxed renderer, context isolation, no renderer Node access, and a restricted preload bridge.
- Unsafe sandbox/TLS launch flags are rejected; debug-port switches are removed. App pages served from a fixed `nxe-app` file whitelist; arbitrary file pages, navigation, subframes, popups, and permissions are denied.
- Privileged IPC requires the exact current main frame and an active admin session. PIN failures are throttled; PIN-off is an explicit administrator preference.
- Local artwork/audio is limited by type, size, and allowed directory. Symlinks/path escapes and inherited-object asset keys are rejected. Cover IDs cannot create paths outside the cache.
- Configuration and cover updates use random, exclusive temporary files and atomic replacement; predictable existing temp files are not followed.
- Cover downloads use fixed HTTPS GitHub endpoints, bounded requests, validated IDs/JPEG signatures, and no redirects. The renderer's CSP blocks outbound fetches.
- Emulator launch uses saved paths, registered game IDs, argument arrays, and `shell: false`.
- The Windows helper uses an absolute OS PowerShell path, fixed numeric parameters, and a script integrity check.
- Packaged Electron disables RunAsNode, Node environment options, inspector CLI flags, and extra file-page privileges. ASAR-only loading and embedded integrity verification are enabled; integrity enforcement is supported on Windows/macOS.
- Unused import IPC endpoints and runtime decoder binaries are excluded. Asset-recovery tooling stays developer-only.

## Verification

35 regression tests passed. Packaged checks rejected private-file, traversal/prototype, unsupported-file, and unauthorized-admin requests. A renderer network probe produced zero HTTP requests, and an HTML-like ROM title did not execute markup. Disc navigation, cover correction/rescan, audio, and native handoff tests passed. Actual executable fuse settings were inspected. Standalone release boot also ignored a harmless NODE_OPTIONS preload attempt, kept the requested debug port closed, and explicitly refused --no-sandbox.

The full and production npm audits report zero known vulnerabilities as of the review date. Electron is 44.7.0. This does not cover unknown vulnerabilities or separately supplied Xenia/Wine/Proton/GPU drivers.

The tracked publication scan covered 733 files and 197 historical text blobs for common token/private-key patterns and the developer's home-directory path; no matches were found. Pattern-based scanning is not exhaustive. Configurations, credential files, logs, certificates, and environment files are excluded from future commits by ignore rules.

## Use and distribution

- Change the initial **1234** PIN before child/unattended use. Keep PIN protection enabled if users must not change settings or exit.
- Run under a limited account. The PIN is a UI lock, not OS authentication; anyone able to modify the app/profile or run programs as that same account already has broader host access.
- Install Xenia/runners from trusted sources and keep the OS, drivers, Electron, and dependencies updated. No emulator is bundled or certified by this review.
- Distribute the hardened installer and its checksum. It is unsigned; signing/secure release distribution remain release-owner responsibilities.
- Verify Linux Mint builds, sandbox behavior, and Wine/Proton on the target system. Those runtime checks remain pending.

## Reporting

Report security concerns to the repository maintainer through the repository's Security channels where available. Do not put PINs, full local configurations, ROMs, tokens, or exploitable private data into a public issue.

References: [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security), [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses).
