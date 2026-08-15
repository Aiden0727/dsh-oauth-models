import assert from 'node:assert/strict'
import { access, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { FileCredentialStore } from '../lib/file-credential-store.js'

const roots = new Set()

test.afterEach(async () => {
  await Promise.all([...roots].map(root => rm(root, { recursive: true, force: true })))
  roots.clear()
})

async function temporaryStore() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-oauth-models-test-'))
  roots.add(root)
  const path = join(root, 'private', 'oauth-credentials.json')
  return { root, path, store: new FileCredentialStore(path) }
}

test('stores OAuth credentials without exposing them through list()', async () => {
  const { path, store } = await temporaryStore()
  const credential = {
    type: 'oauth',
    access: 'access-secret',
    refresh: 'refresh-secret',
    expires: Date.now() + 60_000,
    accountId: 'account-1',
  }
  await store.modify('openai-codex', async () => credential)
  assert.deepEqual(await store.read('openai-codex'), credential)
  assert.deepEqual(await store.list(), [{ providerId: 'openai-codex', type: 'oauth' }])
  if (process.platform !== 'win32') assert.equal((await stat(path)).mode & 0o777, 0o600)
})

test('serializes concurrent credential updates', async () => {
  const { store } = await temporaryStore()
  await Promise.all([
    store.modify('openai-codex', async () => ({
      type: 'oauth', access: 'openai', refresh: 'openai-refresh', expires: 1,
    })),
    store.modify('anthropic', async () => ({
      type: 'oauth', access: 'anthropic', refresh: 'anthropic-refresh', expires: 2,
    })),
  ])
  assert.equal((await store.read('openai-codex'))?.type, 'oauth')
  assert.equal((await store.read('anthropic'))?.type, 'oauth')
})

test('serializes updates across independent store instances', async () => {
  const { path, store: first } = await temporaryStore()
  const second = new FileCredentialStore(path)
  let releaseFirst
  let firstHasLock
  const locked = new Promise(resolve => { firstHasLock = resolve })
  const release = new Promise(resolve => { releaseFirst = resolve })
  const firstWrite = first.modify('openai-codex', async () => {
    firstHasLock()
    await release
    return { type: 'oauth', access: 'openai', refresh: 'openai-refresh', expires: 1 }
  })
  await locked
  const secondWrite = second.modify('anthropic', async () => ({
    type: 'oauth', access: 'anthropic', refresh: 'anthropic-refresh', expires: 2,
  }))
  releaseFirst()
  await Promise.all([firstWrite, secondWrite])
  assert.equal((await first.read('openai-codex'))?.type, 'oauth')
  assert.equal((await first.read('anthropic'))?.type, 'oauth')
})

test('deletes only the selected provider', async () => {
  const { store } = await temporaryStore()
  await store.modify('openai-codex', async () => ({
    type: 'oauth', access: 'a', refresh: 'b', expires: 1,
  }))
  await store.modify('anthropic', async () => ({
    type: 'oauth', access: 'c', refresh: 'd', expires: 2,
  }))
  await store.delete('openai-codex')
  assert.equal(await store.read('openai-codex'), undefined)
  assert.equal((await store.read('anthropic'))?.type, 'oauth')
})

test('removes an empty credential document after the last logout', async () => {
  const { path, store } = await temporaryStore()
  await store.modify('openai-codex', async () => ({
    type: 'oauth', access: 'a', refresh: 'b', expires: 1,
  }))
  await store.delete('openai-codex')
  await assert.rejects(access(path), { code: 'ENOENT' })
})
