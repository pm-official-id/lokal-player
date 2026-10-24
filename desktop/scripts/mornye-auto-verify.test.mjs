// The automatic verification pass must open a window only for a signed-session
// addon whose session existed and has lapsed: never for first-time setup, a
// healthy session, a turned-off addon, missing required settings, or one
// disconnected on purpose.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PackageService } = require('../electron/mornye/packages')
const { SignedSession } = require('../electron/mornye/session')
const { AddonStorage } = require('../electron/mornye/storage')
const { needsAutoVerify } = require('../electron/mornye/autoVerify')

const MANIFEST = {
  name: 'tidal-web', displayName: 'Tidal', version: '1.0.0', type: ['download_provider'],
  methods: [], signedSession: { baseUrl: 'https://gw.example' },
}

async function makePackages({ lapsed, authenticated }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lokal-autoverify-'))
  const packages = {
    root, storage: new AddonStorage(root),
    find: () => ({ key: MANIFEST.name, name: MANIFEST.name, manifest: MANIFEST }),
  }
  const session = new SignedSession(MANIFEST.signedSession, packages.storage, null, MANIFEST.name)
  const record = session.record()
  if (lapsed || authenticated) {
    session.save({ ...record, session_id: 'sid', session_secret: 'sec', expires_at: authenticated ? new Date(Date.now() + 3600_000).toISOString() : new Date(Date.now() - 3600_000).toISOString() })
  }
  return { packages, cleanup: () => fs.rm(root, { recursive: true, force: true }) }
}

const view = extra => ({ key: MANIFEST.name, name: 'Tidal', enabled: true, signedSession: true, access: { verified: false, missing: [] }, ...extra })

test('a lapsed session is the one case that re-verifies on its own', async () => {
  const { packages, cleanup } = await makePackages({ lapsed: true })
  try { assert.equal(needsAutoVerify(packages, view()), true) } finally { await cleanup() }
})

test('a healthy session is left alone', async () => {
  const { packages, cleanup } = await makePackages({ authenticated: true })
  try { assert.equal(needsAutoVerify(packages, view({ access: { verified: true, missing: [] } })), false) } finally { await cleanup() }
})

test('first-time setup never opens a window by itself', async () => {
  const { packages, cleanup } = await makePackages({})
  try { assert.equal(needsAutoVerify(packages, view()), false) } finally { await cleanup() }
})

test('a disconnected addon (session cleared) is not re-verified', async () => {
  const { packages, cleanup } = await makePackages({ lapsed: true })
  try {
    new SignedSession(MANIFEST.signedSession, packages.storage, null, MANIFEST.name).clear()
    assert.equal(needsAutoVerify(packages, view()), false)
  } finally { await cleanup() }
})

test('a turned-off addon or one with required settings missing is skipped', async () => {
  const { packages, cleanup } = await makePackages({ lapsed: true })
  try {
    assert.equal(needsAutoVerify(packages, view({ enabled: false })), false)
    assert.equal(needsAutoVerify(packages, view({ access: { verified: false, missing: ['Token'] } })), false)
  } finally { await cleanup() }
})

test('addons without a signed session are out of scope', () => {
  const packages = { storage: null, find: () => null }
  assert.equal(needsAutoVerify(packages, { key: 'x', enabled: true, signedSession: false, access: { verified: false, missing: [] } }), false)
  assert.equal(needsAutoVerify(packages, null), false)
})

test('PackageService instances work with needsAutoVerify (same shape as the singleton)', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lokal-autoverify-svc-'))
  const db = new (require('better-sqlite3'))(':memory:')
  db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)')
  const packages = new PackageService(db, { root, tools: () => ({}) })
  try {
    db.prepare('INSERT INTO mornye_packages (key,name,manifest_json,repository_id,digest,enabled,installed_at,methods_json) VALUES (?,?,?,?,?,?,?,?)')
      .run(MANIFEST.name, MANIFEST.name, JSON.stringify(MANIFEST), null, 'd1', 1, Date.now(), '[]')
    const [installed] = packages.list()
    // Listed but never verified: the automatic pass must not touch it.
    assert.equal(installed.signedSession, true)
    assert.equal(needsAutoVerify(packages, installed), false)
  } finally { db.close(); await fs.rm(root, { recursive: true, force: true }) }
})
