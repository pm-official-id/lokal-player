# android-build — Lokal Mobile with Mornye auto-verify

The full Android Lokal app ([Lokal-Konnekt/lokal-mobile](https://github.com/Lokal-Konnekt/lokal-mobile)
v1.4.2, Flutter + Rust) with the same automatic Mornye verification as the desktop build:

- 12 seconds after launch and every 30 minutes, signed-session addons (Tidal, Qobuz, Deezer,
  Amazon Music, …) whose session existed and has lapsed are re-verified on their own — the same
  flow as the Verify button. Silent when the gateway clears it; the in-app auth sheet opens by
  itself when it needs you. First-time setup, disabled addons, missing settings and intentional
  logouts are never touched.
- Verified: 6 new unit tests plus the app's full Mornye suite (52/52); app installed and run on
  an Android emulator past the auto-verify mark with no errors.

## Download the APK

GitHub does not allow files over 100 MB inside the repository, so the APK is a release asset:

**[Lokal-Mobile-1.4.2-autoverify.apk](https://github.com/pm-official-id/lokal-player/releases/download/mobile-v1.4.2-av1/Lokal-Mobile-1.4.2-autoverify.apk)** (150 MB, universal, arm64 + armv7 + x86 + x86_64)

Verify with `shasum -a 256` against `SHA256SUMS` in this folder.

### Install notes

- Signed with a local build keystore, not Lokal-Konnekt's release key — it installs fresh, but
  it will **not update over the official v1.4.2** (uninstall that first if present).
- Optimized release build: AOT-compiled Dart, release Rust libraries, all four ABIs in one APK
  (per-ABI splitting is disabled by the project's own Gradle `abiFilters`; upstream ships
  universal too). Icon tree-shaking is off to keep the build reproducible on memory-tight
  machines (`--no-tree-shake-icons`).

## In this folder

| File | What |
|---|---|
| `lokal-mobile-auto-verify.patch` | the complete change as a single commit, applicable to the upstream repo (`git am`) |
| `SHA256SUMS` | checksum of the release APK |

The patch touches four files upstream: adds `lib/features/morneye/morneye_auto_verify.dart`
(the pass + timer), adds `hadSession()` to `morneye_packages.dart`, wires the start-up hook in
`lib/main.dart`, and adds `test/morneye/morneye_auto_verify_test.dart`.
