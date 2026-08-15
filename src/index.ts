import type { IncomingMessage, ServerResponse } from 'node:http'
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import {
  createModels,
  type Api,
  type AuthEvent,
  type AuthPrompt,
  type Models,
  type Provider,
  type ProviderHeaders,
} from '@earendil-works/pi-ai'
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { LlmError, ReasoningEffortId, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import {
  PiAiAdapter,
  type ResolvedPiAiProviderProfile,
} from '@deepseek-ai/dsh-llm-pi-ai'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { FileCredentialStore } from './file-credential-store.js'
import { isTrustedLocalRequest } from './request-security.js'

export { FileCredentialStore } from './file-credential-store.js'
export { isTrustedLocalRequest } from './request-security.js'

export const name = 'dsh-oauth-models'
export const inject = ['llm', 'settings', 'webServer']

export interface Config {
  credentialFile: string
  pagePath: string
  streamIdleTimeoutMs: number
}

export const Config: z<Config> = z.object({
  credentialFile: z.string().required(),
  pagePath: z.string().default('/oauth-models'),
  streamIdleTimeoutMs: z.number().min(1_000).max(2_147_483_647).default(300_000),
})

const PROVIDERS = ['openai-codex', 'anthropic'] as const
type OAuthProviderId = typeof PROVIDERS[number]
type LoginPhase = 'idle' | 'starting' | 'waiting' | 'authorized' | 'error'

interface LoginStatus {
  phase: LoginPhase
  message: string
  manualInputRequired?: boolean
}

type ManualCodePrompt = Extract<AuthPrompt, { type: 'manual_code' }>

interface PendingManualInput {
  message: string
  placeholder?: string
  resolve: (value: string) => void
  reject: (error: Error) => void
}

export class ManualAuthInputBroker {
  private readonly pending = new Map<string, PendingManualInput>()

  describe(provider: string): Pick<PendingManualInput, 'message' | 'placeholder'> | undefined {
    const current = this.pending.get(provider)
    return current === undefined
      ? undefined
      : { message: current.message, ...(current.placeholder === undefined ? {} : { placeholder: current.placeholder }) }
  }

  wait(provider: string, prompt: ManualCodePrompt): Promise<string> {
    if (this.pending.has(provider)) return Promise.reject(new Error(`${provider} 已在等待授权回调`))
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (action: () => void): void => {
        if (settled) return
        settled = true
        prompt.signal?.removeEventListener('abort', abort)
        this.pending.delete(provider)
        action()
      }
      const abort = (): void => finish(() => reject(new Error('授权输入已结束')))
      if (prompt.signal?.aborted) {
        abort()
        return
      }
      this.pending.set(provider, {
        message: prompt.message,
        ...(prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder }),
        resolve: value => finish(() => resolve(value)),
        reject: error => finish(() => reject(error)),
      })
      prompt.signal?.addEventListener('abort', abort, { once: true })
    })
  }

  submit(provider: string, input: string): void {
    const current = this.pending.get(provider)
    if (current === undefined) throw new Error(`${provider} 当前没有等待中的授权回调`)
    const value = input.trim()
    if (value.length === 0) throw new Error('授权回调不能为空')
    current.resolve(value)
  }

  cancel(provider: string): void {
    this.pending.get(provider)?.reject(new Error('授权流程已取消'))
  }
}

type LocaleId = 'zh' | 'en'
type SpeedMode = 'standard' | 'fast'

interface ModelSpeedSettings {
  codexSpeed: SpeedMode
  claudeSpeed: SpeedMode
}

interface DefaultModelSettings {
  provider: string
  model: string
  reasoningEffort?: string
}

const DEFAULT_MODEL_SETTINGS_NAMESPACE = settingsNamespace('agent-default-model')
const DEFAULT_MODEL_SETTINGS_SCHEMA: z<DefaultModelSettings> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  reasoningEffort: z.string(),
})
const MODEL_SPEED_SETTINGS_NAMESPACE = settingsNamespace('oauth-models')
const DEFAULT_MODEL_SPEED_SETTINGS: ModelSpeedSettings = {
  codexSpeed: 'standard',
  claudeSpeed: 'standard',
}
const MODEL_SPEED_SETTINGS_SCHEMA: z<ModelSpeedSettings> = z.object({
  codexSpeed: z.union([z.const('standard'), z.const('fast')]).default('standard'),
  claudeSpeed: z.union([z.const('standard'), z.const('fast')]).default('standard'),
})
const CODEX_FAST_MODELS = new Set([
  'gpt-5.4',
  'gpt-5.5',
  'gpt-5.6',
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
])
const CLAUDE_FAST_MODELS = new Set([
  'claude-opus-4-8',
  'claude-opus-5',
])
const ANTHROPIC_FAST_BETA = 'fast-mode-2026-02-01'
const ANTHROPIC_OAUTH_BETAS = ['claude-code-20250219', 'oauth-2025-04-20']

class OAuthAgentDefaultModel extends Service {
  constructor(
    ctx: Context,
    private readonly source: () => DefaultModelSettings,
    private readonly save: (next: DefaultModelSettings) => Promise<void>,
  ) {
    super(ctx, 'agentDefaultModel')
  }

  currentSelection(): DefaultModelSettings {
    const value = this.source()
    return {
      provider: value.provider,
      model: value.model,
      ...(value.reasoningEffort === undefined
        ? {}
        : { reasoningEffort: ReasoningEffortId(value.reasoningEffort) }),
    }
  }

  async saveSelection(next: DefaultModelSettings): Promise<void> {
    await this.save({
      provider: next.provider,
      model: next.model,
      ...(next.reasoningEffort === undefined ? {} : { reasoningEffort: next.reasoningEffort }),
    })
  }
}

const SERVER_COPY = {
  zh: {
    title: 'DSH 官方账号授权',
    intro: '通过 Pi 的官方 OAuth provider 接入 Codex 与 Claude，不使用 API Key。',
    authorized: '账号已授权；模型请求会自动刷新凭据。',
    starting: '正在启动官方授权…',
    waiting: '请在官方页面完成授权…',
    idle: '尚未授权',
    expires: '当前 access token 到期时间',
    login: '开始官方授权',
    logout: '退出授权',
    refresh: '刷新状态',
    note: 'OAuth 凭据保存在本机独立文件中；本页不会显示 access token 或 refresh token。授权窗口完成后关闭新标签页，再刷新此页。',
  },
  en: {
    title: 'DSH Account Authorization',
    intro: 'Connect Codex and Claude through Pi provider-owned OAuth without entering an API key.',
    authorized: 'Account authorized. Credentials refresh automatically for model requests.',
    starting: 'Starting official authorization…',
    waiting: 'Complete authorization on the official page…',
    idle: 'Not authorized',
    expires: 'Access token expires',
    login: 'Authorize account',
    logout: 'Sign out',
    refresh: 'Refresh status',
    note: 'OAuth credentials stay in a separate local file. This page never displays access or refresh tokens. Close the authorization tab when finished, then refresh this page.',
  },
} as const

function isOAuthProvider(value: string | null): value is OAuthProviderId {
  return value !== null && PROVIDERS.includes(value as OAuthProviderId)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function noStoreHeaders(contentType: string): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'content-type': contentType,
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  }
}

function forbidden(res: ServerResponse): void {
  json(res, 403, { error: 'forbidden' })
}

function json(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    ...noStoreHeaders('application/json; charset=utf-8'),
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function html(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, noStoreHeaders('text/html; charset=utf-8'))
  res.end(body)
}

function methodNotAllowed(res: ServerResponse, allowed: string): void {
  res.writeHead(405, { ...noStoreHeaders('text/plain; charset=utf-8'), allow: allowed })
  res.end('Method not allowed')
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 16_384) throw new Error('request_too_large')
    chunks.push(buffer)
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (value === null || Array.isArray(value) || typeof value !== 'object') throw new Error('invalid_json')
  return value as Record<string, unknown>
}

function apiKeyRequestProvider<TApi extends Api>(provider: Provider<TApi>): Provider<TApi> {
  return {
    ...provider,
    auth: {
      ...provider.auth,
      apiKey: {
        name: `${provider.name} OAuth access token`,
        async resolve({ credential }) {
          return credential?.key
            ? { auth: { apiKey: credential.key }, source: 'OAuth access token' }
            : undefined
        },
      },
    },
  }
}

export function supportsFastSpeed(provider: string, model: string): boolean {
  if (provider === 'openai-codex') return CODEX_FAST_MODELS.has(model)
  if (provider === 'anthropic') return CLAUDE_FAST_MODELS.has(model)
  return false
}

export function applyFastSpeedPayload(provider: string, payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload
  if (provider === 'openai-codex') return { ...payload, service_tier: 'priority' }
  if (provider === 'anthropic') return { ...payload, speed: 'fast' }
  return payload
}

export function anthropicFastHeaders(headers?: ProviderHeaders): ProviderHeaders {
  const next = { ...headers }
  const existingKey = Object.keys(next).find(key => key.toLowerCase() === 'anthropic-beta')
  const existing = existingKey === undefined ? '' : next[existingKey] ?? ''
  const betas = new Set([
    ...ANTHROPIC_OAUTH_BETAS,
    ...existing.split(',').map(value => value.trim()).filter(Boolean),
    ANTHROPIC_FAST_BETA,
  ])
  if (existingKey !== undefined && existingKey !== 'anthropic-beta') delete next[existingKey]
  next['anthropic-beta'] = [...betas].join(',')
  return next
}

function speedSetting(settings: ModelSpeedSettings, provider: OAuthProviderId): SpeedMode {
  return provider === 'openai-codex' ? settings.codexSpeed : settings.claudeSpeed
}

function speedAwareProvider<TApi extends Api>(
  provider: Provider<TApi>,
  currentSpeedSettings: () => ModelSpeedSettings,
): Provider<TApi> {
  const authenticated = apiKeyRequestProvider(provider)
  return {
    ...authenticated,
    streamSimple(model, context, options) {
      const fast = speedSetting(currentSpeedSettings(), provider.id as OAuthProviderId) === 'fast'
        && supportsFastSpeed(provider.id, model.id)
      if (!fast) return authenticated.streamSimple(model, context, options)

      const previousTransform = options?.onPayload
      return authenticated.streamSimple(model, context, {
        ...options,
        ...(provider.id === 'anthropic' ? { headers: anthropicFastHeaders(options?.headers) } : {}),
        onPayload: async (payload, resolvedModel) => {
          const transformed = await previousTransform?.(payload, resolvedModel)
          return applyFastSpeedPayload(provider.id, transformed === undefined ? payload : transformed)
        },
      })
    },
  }
}

function resolvedProfile<TApi extends Api>(
  provider: Provider<TApi>,
  streamIdleTimeoutMs: number,
  currentSpeedSettings: () => ModelSpeedSettings,
): ResolvedPiAiProviderProfile {
  return {
    provider: provider.id,
    displayName: provider.name,
    streamIdleTimeoutMs,
    retryPolicy: resolveRetryPolicy(undefined, `dsh-oauth-models: ${provider.id}`),
    configuredMaxTokens: new Map(),
    piProvider: speedAwareProvider(provider, currentSpeedSettings),
  }
}

function providerTitle(provider: OAuthProviderId, locale: LocaleId): string {
  return provider === 'openai-codex'
    ? locale === 'zh' ? 'OpenAI Codex（ChatGPT Plus/Pro）' : 'OpenAI Codex (ChatGPT Plus/Pro)'
    : locale === 'zh' ? 'Anthropic（Claude Pro/Max）' : 'Anthropic (Claude Pro/Max)'
}

class OAuthController {
  readonly store: FileCredentialStore
  readonly models: Models
  readonly status = new Map<OAuthProviderId, LoginStatus>()
  readonly active = new Set<OAuthProviderId>()
  readonly manualInputs = new ManualAuthInputBroker()

  constructor(path: string) {
    this.store = new FileCredentialStore(path)
    const models = createModels({ credentials: this.store })
    models.setProvider(openaiCodexProvider())
    models.setProvider(anthropicProvider())
    this.models = models
  }

  async describe(provider: OAuthProviderId): Promise<LoginStatus & { expires?: number }> {
    const credential = await this.store.read(provider)
    const current = this.status.get(provider)
    if (this.active.has(provider)) {
      return {
        ...(current ?? { phase: 'starting', message: '正在启动官方授权…' }),
        ...(this.manualInputs.describe(provider) === undefined ? {} : { manualInputRequired: true }),
      }
    }
    if (credential?.type === 'oauth') {
      return {
        phase: 'authorized',
        message: '账号已授权；模型请求会自动刷新凭据。',
        expires: credential.expires,
      }
    }
    return current?.phase === 'error' ? current : { phase: 'idle', message: '尚未授权' }
  }

  async accessToken(provider: OAuthProviderId): Promise<string> {
    const result = await this.models.getAuth(provider)
    const token = result?.auth.apiKey
    if (!token) throw new LlmError(`${provider} 尚未完成 OAuth 授权`, 'MISSING_CREDENTIAL')
    return token
  }

  start(provider: OAuthProviderId, onEvent: (event: AuthEvent) => void): Promise<void> {
    if (this.active.has(provider)) return Promise.reject(new Error(`${provider} 已有授权流程正在进行`))
    this.active.add(provider)
    this.status.set(provider, { phase: 'starting', message: '正在启动官方授权…' })
    return this.models.login(provider, 'oauth', {
      prompt: async prompt => {
        if (prompt.type === 'select') return 'browser'
        if (prompt.type === 'manual_code') return this.manualInputs.wait(provider, prompt)
        throw new Error(`当前授权页面不支持交互类型：${prompt.type}`)
      },
      notify: (event) => {
        if (event.type === 'auth_url') {
          this.status.set(provider, { phase: 'waiting', message: '请在官方页面完成授权…' })
        } else if (event.type === 'progress') {
          this.status.set(provider, { phase: 'waiting', message: event.message })
        }
        onEvent(event)
      },
    }).then(() => {
      this.status.set(provider, { phase: 'authorized', message: '账号授权成功' })
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      this.status.set(provider, { phase: 'error', message })
      throw error
    }).finally(() => {
      this.active.delete(provider)
    })
  }

  async logout(provider: OAuthProviderId): Promise<void> {
    this.manualInputs.cancel(provider)
    await this.models.logout(provider)
    this.status.set(provider, { phase: 'idle', message: '已退出账号授权' })
  }

  submitManualInput(provider: OAuthProviderId, input: string): void {
    this.manualInputs.submit(provider, input)
    this.status.set(provider, { phase: 'waiting', message: '正在验证授权回调…' })
  }
}

function localeFromRequest(req: IncomingMessage): LocaleId {
  const requested = new URL(req.url ?? '/', 'http://dsh.invalid').searchParams.get('lang')
  if (requested === 'zh' || requested === 'en') return requested
  return req.headers['accept-language']?.toLowerCase().startsWith('en') ? 'en' : 'zh'
}

function localizedStatus(status: LoginStatus, locale: LocaleId): string {
  if (status.phase === 'error') return status.message
  return SERVER_COPY[locale][status.phase]
}

async function page(controller: OAuthController, pagePath: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const locale = localeFromRequest(req)
  const copy = SERVER_COPY[locale]
  const cards = await Promise.all(PROVIDERS.map(async provider => {
    const status = await controller.describe(provider)
    const expiry = status.expires === undefined
      ? ''
      : `<div class="meta">${copy.expires}: ${escapeHtml(new Date(status.expires).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US'))}</div>`
    const action = status.phase === 'authorized'
      ? `<form method="post" action="${pagePath}/logout?provider=${provider}&lang=${locale}"><button class="secondary" type="submit">${copy.logout}</button></form>`
      : `<form method="post" target="_blank" action="${pagePath}/login?provider=${provider}&lang=${locale}"><button type="submit">${copy.login}</button></form>`
    return `<section><h2>${escapeHtml(providerTitle(provider, locale))}</h2><div class="status ${status.phase}">${escapeHtml(localizedStatus(status, locale))}</div>${expiry}${action}</section>`
  }))
  html(res, 200, `<!doctype html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DSH OAuth Models</title><style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif}body{max-width:880px;margin:48px auto;padding:0 20px;background:#f5f7fa;color:#20242b}header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}h1{margin:0 0 8px}p{color:#667085}.languages{display:flex;gap:6px}.languages a{padding:6px 10px;border:1px solid #d8dee8;border-radius:999px;color:#475467;text-decoration:none}.languages a.active{background:#1769d2;border-color:#1769d2;color:white}section{margin:18px 0;padding:22px;border:1px solid #d8dee8;border-radius:14px;background:white}h2{margin-top:0}.status{padding:10px 12px;border-radius:8px;background:#eef2f7;margin:12px 0}.authorized{background:#e7f7ed;color:#176b38}.error{background:#fff0f0;color:#a61b1b}.waiting,.starting{background:#fff7df;color:#825b00}.meta{font-size:13px;color:#667085;margin:8px 0 14px}form{display:inline-block;margin-right:8px}button,a.button{border:0;border-radius:8px;padding:10px 16px;background:#1769d2;color:white;cursor:pointer;text-decoration:none;font-size:14px}.secondary{background:#596579}.note{font-size:13px;margin-top:24px}
@media(prefers-color-scheme:dark){body{background:#11151b;color:#eef2f7}section{background:#1b222c;border-color:#354052}p,.meta{color:#aab4c3}.status{background:#293342}.authorized{background:#183b28;color:#8fe0ac}.error{background:#481f24;color:#ffb4b4}.waiting,.starting{background:#443716;color:#f5d477}}
</style></head><body><header><div><h1>${copy.title}</h1><p>${copy.intro}</p></div><nav class="languages" aria-label="Language"><a class="${locale === 'zh' ? 'active' : ''}" href="${pagePath}?lang=zh">中文</a><a class="${locale === 'en' ? 'active' : ''}" href="${pagePath}?lang=en">EN</a></nav></header>${cards.join('')}<a class="button secondary" href="${pagePath}?lang=${locale}">${copy.refresh}</a><p class="note">${copy.note}</p></body></html>`)
}

function providerFromRequest(req: IncomingMessage): OAuthProviderId | undefined {
  const url = new URL(req.url ?? '/', 'http://dsh.invalid')
  const provider = url.searchParams.get('provider')
  return isOAuthProvider(provider) ? provider : undefined
}

async function login(
  controller: OAuthController,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!isTrustedLocalRequest(req)) return forbidden(res)
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  const provider = providerFromRequest(req)
  if (provider === undefined) return json(res, 400, { error: 'invalid_provider' })

  let firstSettled = false
  let settleFirst!: () => void
  const first = new Promise<void>(resolve => { settleFirst = resolve })
  const task = controller.start(provider, (event) => {
    if (event.type !== 'auth_url' || res.headersSent) return
    res.writeHead(303, { ...noStoreHeaders('text/plain; charset=utf-8'), location: event.url })
    res.end('Redirecting to official authorization…')
    firstSettled = true
    settleFirst()
  })
  void task.then(() => {
    if (!res.headersSent) html(res, 200, '<p>授权完成，可以关闭此页面。</p>')
  }).catch((error: unknown) => {
    if (!res.headersSent) {
      const message = error instanceof Error ? error.message : String(error)
      html(res, 500, `<h1>授权启动失败</h1><p>${escapeHtml(message)}</p>`)
    }
  }).finally(() => {
    if (!firstSettled) settleFirst()
  })
  await first
}

async function status(controller: OAuthController, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isTrustedLocalRequest(req)) return forbidden(res)
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  const values = Object.fromEntries(await Promise.all(PROVIDERS.map(async provider => [
    provider,
    await controller.describe(provider),
  ])))
  json(res, 200, values)
}

async function completeAuthorization(controller: OAuthController, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isTrustedLocalRequest(req)) return forbidden(res)
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const body = await readJsonBody(req)
    const provider = typeof body.provider === 'string' ? body.provider : null
    const callback = typeof body.callback === 'string' ? body.callback : null
    if (!isOAuthProvider(provider) || callback === null || callback.trim().length === 0) {
      return json(res, 400, { error: 'invalid_authorization_callback' })
    }
    controller.submitManualInput(provider, callback)
    json(res, 202, { accepted: true })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    json(res, 409, { error: 'authorization_callback_rejected', message })
  }
}

function capabilities(providers: readonly Provider[], req: IncomingMessage, res: ServerResponse): void {
  if (!isTrustedLocalRequest(req)) return forbidden(res)
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  json(res, 200, {
    speedModes: ['standard', 'fast'],
    fastModels: Object.fromEntries(providers.map(provider => [
      provider.id,
      provider.getModels().filter(model => supportsFastSpeed(provider.id, model.id)).map(model => model.id),
    ])),
  })
}

async function logout(controller: OAuthController, req: IncomingMessage, res: ServerResponse, pagePath: string): Promise<void> {
  if (!isTrustedLocalRequest(req)) return forbidden(res)
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  const provider = providerFromRequest(req)
  if (provider === undefined) return json(res, 400, { error: 'invalid_provider' })
  await controller.logout(provider)
  const locale = localeFromRequest(req)
  res.writeHead(303, { ...noStoreHeaders('text/plain; charset=utf-8'), location: `${pagePath}?lang=${locale}` })
  res.end('Logged out')
}

export function apply(ctx: Context, config: Config): void {
  if (!config.pagePath.startsWith('/') || config.pagePath.endsWith('/') || config.pagePath.includes('?')) {
    throw new Error('dsh-oauth-models: pagePath 必须是无尾斜杠、无查询参数的绝对路径')
  }
  const controller = new OAuthController(config.credentialFile)
  const providers = [openaiCodexProvider(), anthropicProvider()]
  const defaultModelSettings = ctx.settings.register(
    DEFAULT_MODEL_SETTINGS_NAMESPACE,
    DEFAULT_MODEL_SETTINGS_SCHEMA,
    { base: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } },
  )
  const speedSettings = ctx.settings.register(
    MODEL_SPEED_SETTINGS_NAMESPACE,
    MODEL_SPEED_SETTINGS_SCHEMA,
    { base: DEFAULT_MODEL_SPEED_SETTINGS },
  )
  new OAuthAgentDefaultModel(
    ctx,
    () => defaultModelSettings.get(),
    next => defaultModelSettings.replace(next),
  )
  const currentSpeedSettings = () => speedSettings.get()
  const preferences = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!isTrustedLocalRequest(req)) return forbidden(res)
    if (req.method === 'GET') {
      return json(res, 200, {
        defaultModel: defaultModelSettings.get(),
        speeds: speedSettings.get(),
      })
    }
    if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST')

    try {
      const body = await readJsonBody(req)
      const provider = typeof body.provider === 'string' ? body.provider : null
      const model = typeof body.model === 'string' ? body.model : null
      const reasoningEffort = typeof body.reasoningEffort === 'string' && body.reasoningEffort.length > 0
        ? body.reasoningEffort
        : undefined
      const speed = body.speed === 'fast' ? 'fast' : body.speed === 'standard' ? 'standard' : null
      if (!isOAuthProvider(provider) || model === null || model.length === 0 || speed === null) {
        return json(res, 400, { error: 'invalid_preferences' })
      }

      const modelInfo = await ctx.llm.resolveModelInfo(provider, model)
      if (reasoningEffort !== undefined
        && !modelInfo.reasoning?.efforts.some(effort => effort.id === reasoningEffort)) {
        return json(res, 400, { error: 'unsupported_reasoning_effort' })
      }
      if (speed === 'fast' && !supportsFastSpeed(provider, model)) {
        return json(res, 400, { error: 'unsupported_fast_mode' })
      }

      await defaultModelSettings.replace({
        provider,
        model,
        ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
      })
      const currentSpeeds = speedSettings.get()
      await speedSettings.replace({
        ...currentSpeeds,
        [provider === 'openai-codex' ? 'codexSpeed' : 'claudeSpeed']: speed,
      })
      json(res, 200, {
        defaultModel: defaultModelSettings.get(),
        speeds: speedSettings.get(),
      })
    } catch (cause) {
      ctx.logger.warn('dsh-oauth-models: 保存模型偏好失败：%s', cause instanceof Error ? cause.message : String(cause))
      json(res, 400, { error: 'preferences_rejected' })
    }
  }
  const profiles = new Map<string, ResolvedPiAiProviderProfile>(providers.map(provider => [
    provider.id,
    resolvedProfile(provider, config.streamIdleTimeoutMs, currentSpeedSettings),
  ]))
  const adapter = new PiAiAdapter({
    profiles: () => profiles,
    resolveApiKey: provider => {
      if (!isOAuthProvider(provider)) {
        return Promise.reject(new LlmError(`未知 OAuth provider：${provider}`, 'NO_ADAPTER'))
      }
      return controller.accessToken(provider)
    },
  })

  ctx.effect(() => {
    const unregisterAdapter = ctx.llm.registerAdapter([...PROVIDERS], adapter)
    const disposers = [
      ctx.webServer.register({
        kind: 'exact',
        path: config.pagePath,
        handler: (req, res) => {
          if (!isTrustedLocalRequest(req)) return forbidden(res)
          return req.method === 'GET' ? page(controller, config.pagePath, req, res) : methodNotAllowed(res, 'GET')
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${config.pagePath}/login`,
        handler: (req, res) => login(controller, req, res),
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${config.pagePath}/status`,
        handler: (req, res) => status(controller, req, res),
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${config.pagePath}/complete`,
        handler: (req, res) => completeAuthorization(controller, req, res),
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${config.pagePath}/capabilities`,
        handler: (req, res) => capabilities(providers, req, res),
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${config.pagePath}/preferences`,
        handler: preferences,
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: `${config.pagePath}/logout`,
        handler: (req, res) => logout(controller, req, res, config.pagePath),
      }),
    ]
    return () => {
      for (const dispose of disposers.reverse()) dispose()
      unregisterAdapter()
    }
  }, 'dsh-oauth-models: OAuth 路由、模型适配器与凭据生命周期')
}
