import assert from 'node:assert/strict'
import test from 'node:test'
import {
  anthropicFastHeaders,
  applyFastSpeedPayload,
  supportsFastSpeed,
} from '../lib/index.js'

test('只为官方支持的模型开放 Fast', () => {
  assert.equal(supportsFastSpeed('openai-codex', 'gpt-5.6-sol'), true)
  assert.equal(supportsFastSpeed('openai-codex', 'gpt-5.3-codex-spark'), false)
  assert.equal(supportsFastSpeed('anthropic', 'claude-opus-5'), true)
  assert.equal(supportsFastSpeed('anthropic', 'claude-sonnet-5'), false)
})

test('为 Codex 与 Claude 写入各自的 Fast 请求字段', () => {
  assert.deepEqual(applyFastSpeedPayload('openai-codex', { model: 'gpt-5.6-sol' }), {
    model: 'gpt-5.6-sol',
    service_tier: 'priority',
  })
  assert.deepEqual(applyFastSpeedPayload('anthropic', { model: 'claude-opus-5' }), {
    model: 'claude-opus-5',
    speed: 'fast',
  })
})

test('Claude Fast 请求保留已有 beta 并补齐官方标识', () => {
  const headers = anthropicFastHeaders({ 'Anthropic-Beta': 'existing-beta' })
  assert.equal(headers['Anthropic-Beta'], undefined)
  assert.match(headers['anthropic-beta'], /existing-beta/)
  assert.match(headers['anthropic-beta'], /claude-code-20250219/)
  assert.match(headers['anthropic-beta'], /oauth-2025-04-20/)
  assert.match(headers['anthropic-beta'], /fast-mode-2026-02-01/)
})
