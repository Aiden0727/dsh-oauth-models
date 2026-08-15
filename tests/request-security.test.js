import assert from 'node:assert/strict'
import test from 'node:test'
import { isTrustedLocalRequest } from '../lib/request-security.js'

function request({
  remoteAddress = '127.0.0.1',
  host = '127.0.0.1:3080',
  origin,
  fetchSite,
  encrypted = false,
  authenticated = false,
} = {}) {
  const value = {
    socket: { remoteAddress, encrypted },
    headers: {
      host,
      ...(origin === undefined ? {} : { origin }),
      ...(fetchSite === undefined ? {} : { 'sec-fetch-site': fetchSite }),
    },
  }
  if (authenticated) value[Symbol.for('dsh-auth.authenticated-request')] = true
  return value
}

test('accepts loopback requests and exact browser origins', () => {
  assert.equal(isTrustedLocalRequest(request()), true)
  assert.equal(isTrustedLocalRequest(request({
    host: 'localhost:57447',
    origin: 'http://localhost:57447',
    fetchSite: 'same-origin',
  })), true)
  assert.equal(isTrustedLocalRequest(request({
    host: '[::1]:3080',
    remoteAddress: '::1',
    origin: 'http://[::1]:3080',
  })), true)
})

test('accepts remote peers authenticated by dsh-auth with an exact browser origin', () => {
  assert.equal(isTrustedLocalRequest(request({
    remoteAddress: '21.91.179.20',
    host: '21.91.179.169:18888',
    origin: 'http://21.91.179.169:18888',
    fetchSite: 'same-origin',
    authenticated: true,
  })), true)
  assert.equal(isTrustedLocalRequest(request({
    remoteAddress: '21.91.179.20',
    host: '21.91.179.169:18888',
    fetchSite: 'cross-site',
    authenticated: true,
  })), false)
})

test('rejects remote peers, cross-site requests, and DNS rebinding hosts', () => {
  assert.equal(isTrustedLocalRequest(request({ remoteAddress: '192.168.1.10' })), false)
  assert.equal(isTrustedLocalRequest(request({ fetchSite: 'cross-site' })), false)
  assert.equal(isTrustedLocalRequest(request({ host: 'attacker.example:3080' })), false)
  assert.equal(isTrustedLocalRequest(request({
    host: 'localhost:3080',
    origin: 'http://localhost:9999',
  })), false)
})
