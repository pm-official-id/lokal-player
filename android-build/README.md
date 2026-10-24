# android-build — Lokal Mobile with Mornye auto-verify

The full Android Lokal app ([Lokal-Konnekt/lokal-mobile](https://github.com/Lokal-Konnekt/lokal-mobile)
v1.4.2, Flutter + Rust) with the same automatic Mornye verification as the desktop build:

- 12 seconds after launch and every 30 minutes, signed-session addons (Tidal, Qobuz, Deezer,
  Amazon Music, …) whose session existed and has lapsed are re-verified on their own — the same
  flow as the Verify button. Silent when the gateway clears it; the in-app auth sheet opens by
  itself when it needs you. First-time setup, disabled addons, missing settings and intentional
  logouts are never touched.
- **Backup & restore** (Settings → Data → Backup): one `.lokalbak` file with all settings,
  playlists, account logins (Mornye credentials and sessions, master key included) and the
  library database. Downloaded music is never included. Restoring replaces them all and
  restarts the app.
- Verified: 10 new unit tests (auto-verify gating + backup round-trips) and the app's Mornye
  suite (52/52); the app installed and run on an Android emulator past the auto-verify mark
  with no errors. The repository's wider suite has pre-existing environment failures —
  identical with and without these changes (12/12 on the affected files).

## Download the APK

GitHub does not allow files over 100 MB inside the repository, so the APKs are release assets:

**[Lokal-Mobile-1.4.2-autoverify-arm64.apk](https://github.com/pm-official-id/lokal-player/releases/download/mobile-v1.4.2-av1/Lokal-Mobile-1.4.2-autoverify-arm64.apk)** — **59 MB, arm64-only. For modern 64-bit phones (anything from ~2018 on). The recommended download.**

The earlier 150 MB universal build (all four ABIs, also runs on x86 emulators) is on the same
release page as `Lokal-Mobile-1.4.2-autoverify.apk`. For comparison, upstream's own releases
(v1.2.1 and v1.4.2) are ~145–147 MB universal — the size was never this build's addition; the
arm64-only packaging is what halves it.

Verify with `shasum -a 256` against `SHA256SUMS` in this folder.

### Install notes

- Signed with a local build keystore, not Lokal-Konnekt's release key — it installs fresh, but
  it will **not update over the official v1.4.2** (uninstall that first if present).
- arm64-only, built with `LOKAL_ABIS=arm64-v8a flutter build apk --release --target-platform
  android-arm64 --no-tree-shake-icons` (see the ABI patch below). Icon tree-shaking is off to
  keep the build reproducible on memory-tight machines; it costs ~3 MB.

## In this folder

| File | What |
|---|---|
| `lokal-mobile-auto-verify.patch` | the auto-verify feature as a single commit (`git am`) — adds `lib/features/morneye/morneye_auto_verify.dart`, `hadSession()` in `morneye_packages.dart`, the start-up hook in `lib/main.dart`, and `test/morneye/morneye_auto_verify_test.dart` |
| `lokal-mobile-backup-restore.patch` | the backup & restore feature as a single commit (`git am`): `lib/services/backup_service.dart`, a Backup section in the settings Data group, and round-trip tests |
| `lokal-mobile-abi-override.patch` | optional build patch: a `LOKAL_ABIS` environment variable that limits `ndk abiFilters`, the `copyNdkLibs` staging and `jniLibs` packaging to the built ABI (59 MB arm64 vs 150 MB universal); unset, the build is unchanged |
| `SHA256SUMS` | checksums of the release APKs |
