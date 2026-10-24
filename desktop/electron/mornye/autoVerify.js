// Signed-session addons (Tidal, Qobuz and the like) lose their gateway session
// while the app is closed or idle, and the next play or download then pauses
// with a "Verify access" prompt. This pass re-verifies them on its own: at
// startup and on a slow cycle it replays exactly what the Verify button does
// (package.verifyAndWait), so a challenge that clears without interaction
// completes invisibly, and one that needs the person opens the same window a
// click would have. Addons never set up, addons with required settings left
// empty, and addons disconnected on purpose (their saved session is gone) are
// left alone: only a session that existed and has lapsed is worth re-asking
// the gateway for.
const { service } = require('./packages')
const { SignedSession } = require('./session')

const CYCLE_MS = 30 * 60 * 1000
let running = false

/** A saved session id means this addon was verified before and has since
 *  lapsed; install_id alone (written as soon as the Addons page lists it)
 *  means it was never verified, so no window should open for it. */
function hadSession(packages, addon) {
  try {
    return !!new SignedSession(addon.manifest.signedSession, packages.storage, null, addon.key)
      .status().session_id
  } catch { return false }
}

/** Whether the automatic pass should re-verify this addon now. */
function needsAutoVerify(packages, view) {
  if (!view?.signedSession || !view.enabled) return false
  const access = view.access || {}
  if (access.verified || access.missing?.length) return false
  const addon = packages.find(view.key)
  return !!addon?.manifest?.signedSession && hadSession(packages, addon)
}

/** Tell the windows, the way the auth window does when it closes, so a
 *  session renewed in the background (no window opened) still reaches the
 *  Addons page and the setup notices. */
function announce(key, status) {
  if (!process.versions.electron) return
  try {
    const { BrowserWindow } = require('electron')
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('addons:auth-changed', { key, ...status })
  } catch {}
}

/** One pass over the installed addons. One addon at a time: verifyAndWait
 *  waits for a window to close, and staggering them keeps the gateway calm.
 *  Outside Electron (the plain web server) verification windows cannot open,
 *  but silent session renewals still work and are worth doing. */
async function verifyOnce(db) {
  if (running) return
  running = true
  try {
    const packages = service(db)
    const dispatch = require('./api').dispatch
    for (const view of packages.list()) {
      try {
        if (!needsAutoVerify(packages, view)) continue
        const before = view.access?.verified
        const status = await dispatch(db, { action: 'package.verifyAndWait', key: view.key })
        if (status?.error) throw new Error(status.error)
        if (!before && status?.authenticated) {
          console.log(`[Mornye] Auto-verified ${view.name}`)
          announce(view.key, status)
        }
      } catch (error) { console.warn(`[Mornye] Auto-verify of ${view?.name || view?.key} failed: ${error.message}`) }
    }
  } finally { running = false }
}

/** Start the automatic passes: once shortly after launch (after the
 *  repositories have refreshed), then on a slow keep-alive cycle. */
function startAutoVerify(db, { delayMs = 12000, cycleMs = CYCLE_MS } = {}) {
  const first = setTimeout(() => { void verifyOnce(db) }, delayMs)
  const loop = setInterval(() => { void verifyOnce(db) }, cycleMs)
  first.unref?.(); loop.unref?.()
  return { stop() { clearTimeout(first); clearInterval(loop) } }
}

module.exports = { needsAutoVerify, verifyOnce, startAutoVerify, CYCLE_MS }
