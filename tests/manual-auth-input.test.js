import assert from 'node:assert/strict'
import test from 'node:test'
import { ManualAuthInputBroker } from '../lib/index.js'

test('delivers a pasted redirect URL to the waiting OAuth prompt', async () => {
  const broker = new ManualAuthInputBroker()
  const pending = broker.wait('openai-codex', {
    type: 'manual_code',
    message: 'Paste the redirect URL',
    placeholder: 'http://localhost:1455/auth/callback',
  })

  assert.deepEqual(broker.describe('openai-codex'), {
    message: 'Paste the redirect URL',
    placeholder: 'http://localhost:1455/auth/callback',
  })
  broker.submit('openai-codex', '  http://localhost:1455/auth/callback?code=example&state=state  ')

  assert.equal(await pending, 'http://localhost:1455/auth/callback?code=example&state=state')
  assert.equal(broker.describe('openai-codex'), undefined)
})

test('removes a pending OAuth prompt when its provider aborts', async () => {
  const broker = new ManualAuthInputBroker()
  const controller = new AbortController()
  const pending = broker.wait('openai-codex', {
    type: 'manual_code',
    message: 'Paste the redirect URL',
    signal: controller.signal,
  })

  controller.abort()

  await assert.rejects(pending, /授权输入已结束/u)
  assert.equal(broker.describe('openai-codex'), undefined)
})

test('rejects manual input when no OAuth prompt is waiting', () => {
  const broker = new ManualAuthInputBroker()
  assert.throws(() => broker.submit('openai-codex', 'callback'), /没有等待中的授权回调/u)
})
