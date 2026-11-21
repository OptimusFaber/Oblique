# Oblique build handoff

Read `../START_HERE.md`, `../AGENT_HANDOFF.md`, and `../BUILD_LOG_SUMMARY.md` before continuing.

This is an unfinished native desktop build. Do not report release readiness based on the React build or prebuilt Go cores. The user wants real Windows and Linux VPN applications/installers, with the v2 design and the current SilentGuard engine, branded Oblique.

- Fix the documented static-slice lifetime blocker in src-tauri/build.rs first. A minimal unapplied patch is at ../evidence/build-script-lifetime.patch.
- Keep package-lock.json, Cargo.lock, core/go.mod/go.sum, and the pinned core/SING_BOX_REVISION. Do not blindly upgrade or replace the engine. Full fork sources are already in core/sing-box; no Git/submodule download is needed after ZIP extraction.
- Both x64 Go cores are already in src-tauri/resources. Rebuild them only if changing core source or verifying reproducibility.
- Prefer native Windows/MSVC for NSIS and Ubuntu 24.04 for DEB/AppImage. Match toolchain to the actual device and available RAM; old VM paths and caches are not portable.
- Record real compiler/test output in log files. Separate PASS, FAIL, and NOT RUN. Never label a browser mock as a native integration test.
- Preserve direct per-outbound readiness checks, controller authentication, independent stop-file nonce, config privacy, graceful shutdown, proxy restoration, and IPv6 capture/reject semantics.
- Do not disable certificate checks or broaden controller/listen scope to get a green test. Synthetic test-only insecure TLS flags are not a production default.
- Linux core capabilities must include cap_net_admin,cap_net_raw,cap_net_bind_service; GUI stays unprivileged. Inspect actual DEB layout before trusting its postinst path.
- Private VPN profiles are not included. The user may provide them separately for native/live validation. Do not add credentials, subscriptions, server configs, or personal keys to repository/installer/logs.
- The user stopped all builds on the original VM. Continue only on the newly selected build device when asked; do not restart the old VM's compilation or publish/push code without an applicable user instruction.
