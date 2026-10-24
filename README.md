# lokal-player

Lokal — a local-first music player — with two additions on top of [sipbuu/lokal](https://github.com/sipbuu/lokal):

1. **Mornye auto-verify** (desktop): signed-session addons (Tidal, Qobuz, Amazon Music, Deezer, …) are re-verified automatically at launch and every 30 minutes, instead of pausing playback with a "Verify access" prompt.
2. **Lokal Remote for Android**: a native Android shell (APK) around Lokal's phone remote UI — enter your computer's address once and control playback from the phone.

## Downloads

Get the builds from the [Releases](https://github.com/pm-official-id/lokal-player/releases) page:

| File | What |
|---|---|
| `Lokal-11.1.6-arm64.dmg` | macOS (Apple Silicon) desktop app, auto-verify build — unsigned, right-click → Open on first launch |
| `Lokal-11.1.6-arm64-mac.zip` | same app as a zip |
| `Lokal-Remote-1.0-debug.apk` | Android remote shell — sideload, then connect to `http://<your-computer>:3421/remote` |

## What changed vs upstream

### Desktop (`desktop/`)

- `electron/mornye/autoVerify.js` — new: background pass that re-verifies lapsed signed-session addons (launch +12 s, then every 30 min). First-time setup and intentional logouts are left alone; only sessions that existed and have lapsed are re-verified. Replays the same flow as the "Verify access" button (`package.verifyAndWait`), so challenges that clear silently complete invisibly, and ones that need interaction open the same window automatically.
- `electron/main.js` — starts the pass at app launch.
- `scripts/mornye-auto-verify.test.mjs` — new test suite (7 tests) for the gating rules.

Everything else is upstream Lokal 11.1.6 (MIT license, © sipbuu). Upstream's GitHub workflows are not included; they belong to the original release pipeline.

### Android (`android/`)

Minimal Kotlin + Compose app (`dev.lokal.remote`):

- Setup screen: enter the computer's `address:port` (default port 3421), saved for next launch.
- Full-screen WebView with the Lokal Remote UI; back button navigates; if the computer is unreachable it returns to setup with the error.
- Lokal's icon as the launcher icon; dark theme to match.

Build it: `cd android && ./gradlew assembleDebug` (or open in Android Studio). APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Using the Android remote

1. Lokal must be running on the computer (its web server listens on port 3421) and the phone must reach it over the network.
2. Install the APK, type the computer's address (e.g. `192.168.1.50:3421`), tap Connect.

All playback, downloads and Mornye source authentication (including auto-verify) run on the desktop; the phone is a remote control.

## Building the desktop app

```bash
cd desktop
npm install
npm run build        # icons → vite → native prepare → electron-builder
```

Tests: `node --test scripts/mornye-auto-verify.test.mjs` plus the suites in `desktop/package.json`.

## Credits

- [sipbuu/lokal](https://github.com/sipbuu/lokal) — the entire player (MIT).
- Mornye addons are installed from the official Mornye registry; this repo only contains the host integration.
