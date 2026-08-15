import type { IncomingMessage } from 'node:http'

const AUTHENTICATED_REQUEST_SYMBOL = Symbol.for('dsh-auth.authenticated-request')

function isLoopbackHost(rawHost: string): boolean {
  if (/[\\/@?#]/u.test(rawHost)) return false
  try {
    const parsed = new URL(`http://${rawHost}`)
    if (
      parsed.username !== ''
      || parsed.password !== ''
      || parsed.pathname !== '/'
      || parsed.search !== ''
      || parsed.hash !== ''
    ) return false
    const bracketless = parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
      ? parsed.hostname.slice(1, -1)
      : parsed.hostname
    const hostname = bracketless.toLowerCase().replace(/\.$/u, '')
    return hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '::ffff:127.0.0.1'
  } catch {
    return false
  }
}

function firstForwardedValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const first = raw?.split(',', 1)[0]?.trim()
  return first === '' ? undefined : first
}

function effectiveHost(req: IncomingMessage, authenticatedByHost: boolean): string | undefined {
  if (!authenticatedByHost || req.headers['x-forwarded-host'] === undefined) return req.headers.host
  return firstForwardedValue(req.headers['x-forwarded-host'])
}

function effectiveProtocol(req: IncomingMessage, authenticatedByHost: boolean): 'http' | 'https' | undefined {
  if ((req.socket as IncomingMessage['socket'] & { encrypted?: boolean }).encrypted === true) return 'https'
  if (!authenticatedByHost) return 'http'
  if (req.headers['x-forwarded-proto'] === undefined) return undefined
  const forwarded = firstForwardedValue(req.headers['x-forwarded-proto'])?.toLowerCase()
  return forwarded === 'http' || forwarded === 'https' ? forwarded : undefined
}

function hasExactOrigin(
  req: IncomingMessage,
  rawHost: string,
  rawOrigin: string,
  authenticatedByHost: boolean,
): boolean {
  try {
    const origin = new URL(rawOrigin)
    if (
      origin.username !== ''
      || origin.password !== ''
      || origin.pathname !== '/'
      || origin.search !== ''
      || origin.hash !== ''
    ) return false
    const protocol = effectiveProtocol(req, authenticatedByHost)
    if (protocol !== undefined) return origin.origin === new URL(`${protocol}://${rawHost}`).origin
    if (!authenticatedByHost || req.headers['x-forwarded-proto'] !== undefined) return false
    const expectedHost = new URL(`http://${rawHost}`).host
    return (origin.protocol === 'http:' || origin.protocol === 'https:') && origin.host === expectedHost
  } catch {
    return false
  }
}

/** 仅接受来自当前本机 DSH 页面的授权控制请求，阻止跨站请求和 DNS rebinding。 */
export function isTrustedLocalRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  const authenticatedByHost = Reflect.get(req, AUTHENTICATED_REQUEST_SYMBOL) === true
  if (!authenticatedByHost
    && remote !== '127.0.0.1'
    && remote !== '::1'
    && remote !== '::ffff:127.0.0.1') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = effectiveHost(req, authenticatedByHost)
  if (typeof host !== 'string' || (!authenticatedByHost && !isLoopbackHost(host))) return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  return typeof origin === 'string' && hasExactOrigin(req, host, origin, authenticatedByHost)
}
