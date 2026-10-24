// Phone-triggered Mornye auto-verification. The Android remote (and any
// other client) can ask the desktop to run its automatic verify pass right
// away — when the phone connects, rather than at the next 30-minute tick.
// The same guard as the remote-control routes: a paired link device, the
// REMOTE_TOKEN, or an open server (no token set, local network).
const express = require('express')
const { getDB } = require('../../electron/ipc/db')
const router = express.Router()

function authorized(req) {
  if (req.linkDevice || require('../../electron/link').getLink()?.auth(req.headers['x-remote-token'])) return true
  const token = String(process.env.REMOTE_TOKEN || '').trim()
  if (!token) return true
  const provided = req.headers['x-remote-token'] || req.query.token || req.body?.token
  return provided === token
}

router.use((req, res, next) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' })
  next()
})

/** Signed-session addons with their saved access state — no runtime starts. */
function signedSessionAddons() {
  return require('../../electron/mornye/packages').service(getDB())
    .list()
    .filter(addon => addon.signedSession)
    .map(addon => ({ key: addon.key, name: addon.name, verified: !!addon.access?.verified }))
}

// Run the automatic pass now, then say where each signed-session source
// stands. Overlapping calls are folded into the one already running.
router.post('/verify', async (req, res) => {
  try {
    await require('../../electron/mornye/autoVerify').verifyOnce(getDB())
    res.json({ ok: true, addons: signedSessionAddons() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// The same information without triggering anything (a status glance).
router.get('/verify', (req, res) => {
  try { res.json({ ok: true, addons: signedSessionAddons() }) }
  catch (error) { res.status(500).json({ error: error.message }) }
})

module.exports = router
