window.__ModuleLoader__.load({
  id: 'dsh-oauth-models',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { createElement: h, useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'settings.oauthModels'
    const PROVIDER_IDS = ['openai-codex', 'anthropic']

    const ZH = {
      nav: '账号授权',
      title: 'AI 模型账号授权',
      intro: 'Provider、订阅账号、模型与本地安全凭据',
      language: '界面语言',
      'status.label': 'AI 模型状态',
      'status.idle': '尚未授权',
      'status.starting': '正在启动官方授权…',
      'status.waiting': '请在官方页面完成授权…',
      'status.authorized': '账号已授权',
      'status.error': '授权失败',
      'status.expires': '凭据到期时间：{time}',
      'method.label': '接入方式',
      'method.oauth': '账号授权',
      'method.plan': 'Code / Token Plan',
      'method.api': 'API Key / 自定义',
      'method.planHint': '前往模型页配置兼容 Provider 和 Plan Token',
      'method.apiHint': '前往模型页配置 API Key 或自定义 Provider',
      'models.nav': '模型',
      'error.modelsNavigation': '没有找到原生“模型”设置入口，请刷新页面后重试。',
      'provider.label': '账号 Provider',
      'provider.codex': 'OpenAI Codex · 订阅账号',
      'provider.anthropic': 'Anthropic Claude · 订阅账号',
      'provider.codexShort': 'OpenAI Codex',
      'provider.anthropicShort': 'Anthropic Claude',
      'provider.codexDescription': '使用 ChatGPT Plus/Pro 账号完成 OAuth 授权；API 额度与 ChatGPT 订阅相互独立。',
      'provider.anthropicDescription': '使用 Claude Pro/Max 账号完成 OAuth 授权，不需要在 DSH 中填写 Anthropic API Key。',
      'model.label': '账号模型',
      'model.empty': '当前没有可用模型',
      'reasoning.label': '推理强度',
      'reasoning.auto': '自动（模型默认）',
      'reasoning.off': '关闭',
      'reasoning.minimal': '极低',
      'reasoning.low': '低',
      'reasoning.medium': '中',
      'reasoning.high': '高',
      'reasoning.xhigh': '超高（Extra High）',
      'reasoning.max': '最大（Max）',
      'reasoning.unavailable': '当前模型未提供可调推理强度',
      'speed.label': 'Speed',
      'speed.standard': 'Standard · 标准速度',
      'speed.fast': 'Fast · 高速',
      'speed.unavailable': '当前模型不支持 Fast，将使用 Standard。',
      'speed.codexHint': 'Fast 使用 Codex 优先服务档位，会更快消耗订阅额度。',
      'speed.claudeHint': 'Fast 使用 Claude 高速推理配置，需要账号已开通对应的额外用量能力。',
      'info.label': '授权说明',
      'info.security': '凭据通过 Pi OAuth provider 获取，仅加密传输并保存在本机，不会回填或显示在设置页。',
      'info.warning': '这是社区插件接入，并不代表 DSH 获得模型厂商的合作认证；请遵守对应账号与订阅条款。',
      'actions.label': '账号操作',
      'actions.login': '开始账号授权',
      'actions.waiting': '等待完成授权…',
      'actions.logout': '退出账号授权',
      'actions.setModel': '设为当前模型',
      'actions.refresh': '刷新状态',
      'manual.title': '完成远程授权',
      'manual.help': '官方页面跳转到 localhost:1455 后，请复制浏览器地址栏中的完整链接并粘贴到这里。',
      'manual.placeholder': 'http://localhost:1455/auth/callback?code=…&state=…',
      'manual.submit': '提交回调链接',
      'current.label': 'Pi 当前模型',
      'current.empty': '尚未读取到当前模型',
      'saved.default': '已设为新会话的默认模型。',
      'saved.callback': '回调已提交，正在验证并保存账号凭据。',
      'error.dshHttp': 'DSH 接口返回 HTTP {status}',
      'error.dshCall': 'DSH 接口调用失败',
      'error.authStatus': '授权状态返回 HTTP {status}',
      'error.logout': '退出授权返回 HTTP {status}',
      'error.capabilities': '模型能力返回 HTTP {status}',
      'error.preferences': '模型偏好保存接口返回 HTTP {status}',
      'error.callback': '授权回调提交返回 HTTP {status}',
      'error.noDefaultModel': '当前 DSH 未暴露默认模型设置',
      'error.noSpeedSettings': '当前插件未暴露 Speed 设置，请重启 DSH 后重试',
      foot: 'OAuth 凭据与 API Key 分开保存。已加载 {codex} 个 Codex 模型和 {claude} 个 Claude 模型。',
    }

    const EN = {
      nav: 'Account authorization',
      title: 'AI model account authorization',
      intro: 'Providers, subscription accounts, models, and local credentials',
      language: 'Interface language',
      'status.label': 'Model status',
      'status.idle': 'Not authorized',
      'status.starting': 'Starting official authorization…',
      'status.waiting': 'Complete authorization on the official page…',
      'status.authorized': 'Account authorized',
      'status.error': 'Authorization failed',
      'status.expires': 'Credential expires: {time}',
      'method.label': 'Connection method',
      'method.oauth': 'Account OAuth',
      'method.plan': 'Code / Token Plan',
      'method.api': 'API Key / Custom',
      'method.planHint': 'Open Models to configure a compatible provider and plan token',
      'method.apiHint': 'Open Models to configure an API key or custom provider',
      'models.nav': 'Models',
      'error.modelsNavigation': 'The native Models settings entry was not found. Refresh the page and try again.',
      'provider.label': 'Account provider',
      'provider.codex': 'OpenAI Codex · Subscription',
      'provider.anthropic': 'Anthropic Claude · Subscription',
      'provider.codexShort': 'OpenAI Codex',
      'provider.anthropicShort': 'Anthropic Claude',
      'provider.codexDescription': 'Authorize with a ChatGPT Plus/Pro account. API usage and ChatGPT subscription usage remain separate.',
      'provider.anthropicDescription': 'Authorize with a Claude Pro/Max account without entering an Anthropic API key in DSH.',
      'model.label': 'Account model',
      'model.empty': 'No models are currently available',
      'reasoning.label': 'Reasoning effort',
      'reasoning.auto': 'Auto (model default)',
      'reasoning.off': 'Off',
      'reasoning.minimal': 'Minimal',
      'reasoning.low': 'Low',
      'reasoning.medium': 'Medium',
      'reasoning.high': 'High',
      'reasoning.xhigh': 'Extra High',
      'reasoning.max': 'Max',
      'reasoning.unavailable': 'This model does not expose adjustable reasoning effort',
      'speed.label': 'Speed',
      'speed.standard': 'Standard',
      'speed.fast': 'Fast',
      'speed.unavailable': 'Fast is unavailable for this model. Standard speed will be used.',
      'speed.codexHint': 'Fast uses the Codex priority service tier and consumes subscription allowance faster.',
      'speed.claudeHint': 'Fast uses Claude high-speed inference and requires the corresponding extra-usage access.',
      'info.label': 'Authorization details',
      'info.security': 'Pi obtains the OAuth credential over an encrypted connection and stores it only on this machine. The Settings page never displays or fills it back in.',
      'info.warning': 'This is a community integration and does not imply a vendor partnership or endorsement. Follow the applicable account and subscription terms.',
      'actions.label': 'Account actions',
      'actions.login': 'Authorize account',
      'actions.waiting': 'Waiting for authorization…',
      'actions.logout': 'Sign out account',
      'actions.setModel': 'Set as current model',
      'actions.refresh': 'Refresh status',
      'manual.title': 'Complete remote authorization',
      'manual.help': 'When the official page redirects to localhost:1455, copy the complete URL from the browser address bar and paste it here.',
      'manual.placeholder': 'http://localhost:1455/auth/callback?code=…&state=…',
      'manual.submit': 'Submit callback URL',
      'current.label': 'Current Pi model',
      'current.empty': 'No current model was found',
      'saved.default': 'Set as the default model for new sessions.',
      'saved.callback': 'Callback submitted. Validating and saving the account credential.',
      'error.dshHttp': 'DSH returned HTTP {status}',
      'error.dshCall': 'DSH request failed',
      'error.authStatus': 'Authorization status returned HTTP {status}',
      'error.logout': 'Sign-out returned HTTP {status}',
      'error.capabilities': 'Model capabilities returned HTTP {status}',
      'error.preferences': 'Model preferences returned HTTP {status}',
      'error.callback': 'Authorization callback returned HTTP {status}',
      'error.noDefaultModel': 'This DSH instance does not expose the default model setting',
      'error.noSpeedSettings': 'This plugin instance does not expose Speed settings. Restart DSH and try again.',
      foot: 'OAuth credentials are stored separately from API keys. Loaded {codex} Codex models and {claude} Claude models.',
    }

    const CSS = `
.dshOauthRoot{max-width:820px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:18px}.dshOauthRoot *{box-sizing:border-box}
.dshOauthHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.dshOauthHeading{min-width:0}.dshOauthTitle{margin:0;font-size:22px;font-weight:600;line-height:30px}.dshOauthIntro{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:22px}
.dshOauthLanguages{display:flex;flex:0 0 auto;padding:3px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-module-platform)}.dshOauthLanguage{height:28px;min-width:48px;border:0;border-radius:999px;padding:0 11px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px}.dshOauthLanguage.active{background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 4px rgba(0,0,0,.09);color:var(--dsw-alias-brand-primary);font-weight:600}
.dshOauthGrid{display:grid;grid-template-columns:132px minmax(0,1fr);align-items:start;gap:14px 18px}.dshOauthLabel{padding-top:9px;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:22px}.dshOauthValue{min-width:0}
.dshOauthStatusLine{display:flex;align-items:center;flex-wrap:wrap;gap:0;padding-top:8px;font-size:14px;line-height:22px}.dshOauthDot{display:inline-block;flex:0 0 auto;width:8px;height:8px;margin-right:8px;border-radius:50%;background:var(--dsw-alias-state-error-primary)}.dshOauthDot.ok{background:var(--dsw-alias-state-success-primary)}.dshOauthDot.wait{background:var(--dsw-alias-state-warn-label)}.dshOauthExpiry{width:100%;padding-left:16px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.dshOauthTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dshOauthTab{height:40px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px}.dshOauthTab.active{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent);color:var(--dsw-alias-brand-primary);font-weight:600}.dshOauthTab.link{cursor:pointer}.dshOauthTab.link:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dshOauthSelect{appearance:none;width:100%;height:42px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background-color:var(--dsw-alias-bg-layer-1);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-position:right 14px center;background-repeat:no-repeat;color:var(--dsw-alias-label-primary);padding:0 38px 0 13px;font:inherit;font-size:14px}.dshOauthSelect:focus-visible,.dshOauthButton:focus-visible,.dshOauthLanguage:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.dshOauthSelect:disabled{opacity:.55}
.dshOauthHint{margin:6px 2px 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dshOauthInfo{border:1px solid var(--dsw-alias-border-l2);border-radius:11px;background:var(--dsw-alias-bg-module-platform);padding:15px 17px}.dshOauthInfo strong{display:block;margin-bottom:6px;font-size:14px}.dshOauthInfo p{margin:4px 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.dshOauthInfo .warn{color:var(--dsw-alias-state-warn-label)}
.dshOauthActions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.dshOauthButton{height:36px;border:0;border-radius:18px;padding:0 16px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);cursor:pointer;font:inherit;font-size:14px}.dshOauthButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.dshOauthButton.secondary{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}.dshOauthButton.secondary:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.dshOauthButton.danger{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-state-error-primary)}.dshOauthButton:disabled{cursor:default;opacity:.42}
.dshOauthManual{grid-column:1/-1;border:1px solid var(--dsw-alias-state-warn-label);border-radius:11px;background:var(--dsw-alias-bg-module-platform);padding:14px 16px}.dshOauthManual strong{display:block;font-size:14px}.dshOauthManual p{margin:5px 0 10px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.dshOauthManualForm{display:flex;align-items:center;gap:8px}.dshOauthManualInput{min-width:0;flex:1;height:38px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 12px;font:inherit;font-size:13px}.dshOauthManualInput:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshOauthCurrent{padding-top:7px;font-size:14px;line-height:22px}.dshOauthError{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.dshOauthSaved{margin:0;color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}.dshOauthFoot{border-top:1px solid var(--dsw-alias-border-l2);margin-top:4px;padding-top:14px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:19px}
@media(max-width:680px){.dshOauthHeader{flex-direction:column}.dshOauthGrid{grid-template-columns:1fr;gap:7px}.dshOauthLabel{padding-top:0}.dshOauthTabs{grid-template-columns:1fr}.dshOauthTab:not(.active){display:none}.dshOauthManual{grid-column:auto}.dshOauthManualForm{align-items:stretch;flex-direction:column}}
`

    const styleId = 'dsh-oauth-models/native-settings'
    if (document.querySelector(`style[data-plugin-css="${styleId}"]`) === null) {
      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-oauth-models'
      style.dataset.pluginCss = styleId
      style.textContent = CSS
      document.head.appendChild(style)
    }

    function providerInfo(provider, t) {
      const codex = provider === 'openai-codex'
      return {
        label: t(codex ? 'provider.codex' : 'provider.anthropic'),
        shortLabel: t(codex ? 'provider.codexShort' : 'provider.anthropicShort'),
        description: t(codex ? 'provider.codexDescription' : 'provider.anthropicDescription'),
      }
    }

    function effortLabel(effort, t) {
      const translated = t(`reasoning.${effort}`)
      return translated === `reasoning.${effort}` ? effort : translated
    }

    async function rpc(method, payload, t) {
      const rpcId = globalThis.crypto?.randomUUID?.() ?? `oauth-${Date.now()}-${Math.random()}`
      const response = await fetch(`/api/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
      })
      if (!response.ok) throw new Error(t('error.dshHttp', { status: response.status }))
      const envelope = await response.json()
      if (!envelope.result?.ok) throw new Error(envelope.result?.error?.message ?? t('error.dshCall'))
      return envelope.result.value
    }

    function defaultStatuses() {
      return {
        'openai-codex': { phase: 'idle' },
        anthropic: { phase: 'idle' },
      }
    }

    function statusText(status, t) {
      const key = `status.${status.phase ?? 'idle'}`
      const translated = t(key)
      return status.phase === 'error' && status.message ? `${translated}: ${status.message}` : translated
    }

    function OAuthModelsSection({ t, locale }) {
      const [provider, setProvider] = useState('openai-codex')
      const [statuses, setStatuses] = useState(defaultStatuses)
      const [groups, setGroups] = useState({})
      const [selected, setSelected] = useState({})
      const [selectedEfforts, setSelectedEfforts] = useState({})
      const [selectedSpeeds, setSelectedSpeeds] = useState({})
      const [fastModels, setFastModels] = useState({})
      const [current, setCurrent] = useState(undefined)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [saved, setSaved] = useState('')
      const [manualInputs, setManualInputs] = useState({})
      const refreshing = useRef(false)

      const refresh = useCallback(async (quiet = false) => {
        if (refreshing.current) return
        refreshing.current = true
        if (!quiet) setError('')
        try {
          const [statusResponse, capabilitiesResponse, catalog, preferencesResponse] = await Promise.all([
            fetch('/oauth-models/status', { cache: 'no-store' }),
            fetch('/oauth-models/capabilities', { cache: 'no-store' }),
            rpc('llm.models', {}, t),
            fetch('/oauth-models/preferences', { cache: 'no-store' }),
          ])
          if (!statusResponse.ok) throw new Error(t('error.authStatus', { status: statusResponse.status }))
          if (!capabilitiesResponse.ok) throw new Error(t('error.capabilities', { status: capabilitiesResponse.status }))
          if (!preferencesResponse.ok) throw new Error(t('error.preferences', { status: preferencesResponse.status }))
          setStatuses(await statusResponse.json())
          const capabilities = await capabilitiesResponse.json()
          setFastModels(capabilities.fastModels ?? {})
          const nextGroups = Object.fromEntries((catalog.groups ?? []).map(group => [group.id, group]))
          setGroups(nextGroups)
          setSelected(previous => {
            const next = { ...previous }
            for (const id of PROVIDER_IDS) {
              if (!next[id] && nextGroups[id]?.models?.length) next[id] = nextGroups[id].models[0].id
            }
            return next
          })
          const preferences = await preferencesResponse.json()
          setCurrent(preferences.defaultModel)
          if (preferences.speeds) {
            setSelectedSpeeds(previous => ({
              ...previous,
              'openai-codex': preferences.speeds.codexSpeed ?? 'standard',
              anthropic: preferences.speeds.claudeSpeed ?? 'standard',
            }))
          }
        } catch (cause) {
          if (!quiet) setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          refreshing.current = false
        }
      }, [t])

      useEffect(() => {
        void refresh()
        const timer = window.setInterval(() => {
          if (!document.hidden) void refresh(true)
        }, 5000)
        return () => window.clearInterval(timer)
      }, [refresh])

      const activeLocale = locale.getSnapshot().active
      const info = providerInfo(provider, t)
      const status = statuses[provider] ?? { phase: 'idle' }
      const manualInput = manualInputs[provider] ?? ''
      const models = groups[provider]?.models ?? []
      const model = selected[provider] ?? ''
      const modelInfo = models.find(item => item.id === model)
      const efforts = modelInfo?.reasoning?.efforts ?? []
      const effortKey = `${provider}/${model}`
      const selectedEffort = Object.hasOwn(selectedEfforts, effortKey)
        ? selectedEfforts[effortKey]
        : current?.provider === provider && current?.model === model
          ? current.reasoningEffort ?? ''
          : modelInfo?.reasoning?.defaultEffort ?? ''
      const fastSupported = (fastModels[provider] ?? []).includes(model)
      const selectedSpeed = fastSupported ? selectedSpeeds[provider] ?? 'standard' : 'standard'
      const authorized = status.phase === 'authorized'
      const waiting = status.phase === 'starting' || status.phase === 'waiting'
      const statusClass = authorized ? 'ok' : waiting ? 'wait' : ''
      const currentProvider = current?.provider && PROVIDER_IDS.includes(current.provider)
        ? providerInfo(current.provider, t).shortLabel
        : current?.provider
      const currentEffort = current?.reasoningEffort ? ` · ${effortLabel(current.reasoningEffort, t)}` : ''
      const currentFast = current?.provider && current?.model
        && (fastModels[current.provider] ?? []).includes(current.model)
        && (selectedSpeeds[current.provider] ?? 'standard') === 'fast'
          ? ` · ${t('speed.fast')}`
          : ''
      const currentText = currentProvider && current?.model
        ? `${currentProvider} · ${current.model}${currentEffort}${currentFast}`
        : t('current.empty')
      const expiry = status.expires
        ? t('status.expires', {
            time: new Intl.DateTimeFormat(activeLocale === 'zh' ? 'zh-CN' : 'en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(status.expires)),
          })
        : ''

      const modelOptions = useMemo(() => {
        if (models.length === 0) return [h('option', { key: 'empty', value: '' }, t('model.empty'))]
        return models.map(item => h('option', {
          key: item.id,
          value: item.id,
        }, item.name && item.name !== item.id ? `${item.name} · ${item.id}` : item.id))
      }, [models, t])

      const effortOptions = useMemo(() => [
        h('option', { key: 'auto', value: '' }, efforts.length === 0 ? t('reasoning.unavailable') : t('reasoning.auto')),
        ...efforts.map(item => h('option', { key: item.id, value: item.id }, effortLabel(item.id, t))),
      ], [efforts, t])

      async function logout() {
        setBusy(true)
        setError('')
        setSaved('')
        try {
          const response = await fetch(`/oauth-models/logout?provider=${encodeURIComponent(provider)}&lang=${activeLocale}`, { method: 'POST' })
          if (!response.ok) throw new Error(t('error.logout', { status: response.status }))
          await refresh()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy(false)
        }
      }

      async function completeRemoteAuthorization(event) {
        event.preventDefault()
        const callback = manualInput.trim()
        if (!callback) return
        setBusy(true)
        setError('')
        setSaved('')
        try {
          const response = await fetch('/oauth-models/complete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider, callback }),
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(result.message ?? t('error.callback', { status: response.status }))
          setManualInputs(previous => ({ ...previous, [provider]: '' }))
          setSaved(t('saved.callback'))
          window.setTimeout(() => void refresh(true), 1000)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy(false)
        }
      }

      async function setCurrentModel() {
        if (!model) return
        setBusy(true)
        setError('')
        setSaved('')
        try {
          const response = await fetch('/oauth-models/preferences', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              provider,
              model,
              ...(selectedEffort ? { reasoningEffort: selectedEffort } : {}),
              speed: selectedSpeed,
            }),
          })
          if (!response.ok) throw new Error(t('error.preferences', { status: response.status }))
          const preferences = await response.json()
          setCurrent(preferences.defaultModel)
          setSelectedSpeeds(previous => ({
            ...previous,
            'openai-codex': preferences.speeds?.codexSpeed ?? previous['openai-codex'] ?? 'standard',
            anthropic: preferences.speeds?.claudeSpeed ?? previous.anthropic ?? 'standard',
          }))
          setSaved(t('saved.default'))
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy(false)
        }
      }

      function openNativeModels() {
        const active = document.querySelector('button[aria-current="true"]')
        const buttons = active?.parentElement?.querySelectorAll('button') ?? []
        const expected = t('models.nav').trim().toLocaleLowerCase()
        const target = Array.from(buttons).find(button => button.textContent?.trim().toLocaleLowerCase() === expected)
        if (target instanceof HTMLButtonElement) {
          target.click()
          return
        }
        setError(t('error.modelsNavigation'))
      }

      return h('section', { className: 'dshOauthRoot' },
        h('header', { className: 'dshOauthHeader' },
          h('div', { className: 'dshOauthHeading' },
            h('h2', { className: 'dshOauthTitle' }, t('title')),
            h('p', { className: 'dshOauthIntro' }, t('intro')),
          ),
          h('div', { className: 'dshOauthLanguages', role: 'group', 'aria-label': t('language') },
            h('button', {
              type: 'button',
              className: `dshOauthLanguage ${activeLocale === 'zh' ? 'active' : ''}`,
              'aria-pressed': activeLocale === 'zh',
              onClick: () => locale.setLocale('zh'),
            }, '中文'),
            h('button', {
              type: 'button',
              className: `dshOauthLanguage ${activeLocale === 'en' ? 'active' : ''}`,
              'aria-pressed': activeLocale === 'en',
              onClick: () => locale.setLocale('en'),
            }, 'EN'),
          ),
        ),
        h('div', { className: 'dshOauthGrid' },
          h('div', { className: 'dshOauthLabel' }, t('status.label')),
          h('div', { className: 'dshOauthStatusLine' },
            h('span', { className: `dshOauthDot ${statusClass}` }),
            `${statusText(status, t)} · ${info.shortLabel}`,
            expiry ? h('span', { className: 'dshOauthExpiry' }, expiry) : null,
          ),
          h('div', { className: 'dshOauthLabel' }, t('method.label')),
          h('div', { className: 'dshOauthTabs' },
            h('button', { type: 'button', className: 'dshOauthTab active' }, t('method.oauth')),
            h('button', { type: 'button', className: 'dshOauthTab link', title: t('method.planHint'), onClick: openNativeModels }, t('method.plan')),
            h('button', { type: 'button', className: 'dshOauthTab link', title: t('method.apiHint'), onClick: openNativeModels }, t('method.api')),
          ),
          h('label', { className: 'dshOauthLabel', htmlFor: 'dsh-oauth-provider' }, t('provider.label')),
          h('div', { className: 'dshOauthValue' },
            h('select', {
              id: 'dsh-oauth-provider',
              className: 'dshOauthSelect',
              value: provider,
              onChange: event => { setProvider(event.target.value); setError(''); setSaved('') },
            }, PROVIDER_IDS.map(id => h('option', { key: id, value: id }, providerInfo(id, t).label))),
          ),
          h('label', { className: 'dshOauthLabel', htmlFor: 'dsh-oauth-model' }, t('model.label')),
          h('div', { className: 'dshOauthValue' },
            h('select', {
              id: 'dsh-oauth-model',
              className: 'dshOauthSelect',
              value: model,
              disabled: models.length === 0,
              onChange: event => setSelected(previous => ({ ...previous, [provider]: event.target.value })),
            }, modelOptions),
          ),
          h('label', { className: 'dshOauthLabel', htmlFor: 'dsh-oauth-reasoning' }, t('reasoning.label')),
          h('div', { className: 'dshOauthValue' },
            h('select', {
              id: 'dsh-oauth-reasoning',
              className: 'dshOauthSelect',
              value: selectedEffort,
              disabled: efforts.length === 0,
              onChange: event => setSelectedEfforts(previous => ({ ...previous, [effortKey]: event.target.value })),
            }, effortOptions),
          ),
          h('label', { className: 'dshOauthLabel', htmlFor: 'dsh-oauth-speed' }, t('speed.label')),
          h('div', { className: 'dshOauthValue' },
            h('select', {
              id: 'dsh-oauth-speed',
              className: 'dshOauthSelect',
              value: selectedSpeed,
              disabled: !fastSupported,
              onChange: event => setSelectedSpeeds(previous => ({ ...previous, [provider]: event.target.value })),
            },
            h('option', { value: 'standard' }, t('speed.standard')),
            h('option', { value: 'fast' }, t('speed.fast')),
            ),
            h('p', { className: 'dshOauthHint' }, fastSupported
              ? t(provider === 'openai-codex' ? 'speed.codexHint' : 'speed.claudeHint')
              : t('speed.unavailable')),
          ),
          h('div', { className: 'dshOauthLabel' }, t('info.label')),
          h('div', { className: 'dshOauthInfo' },
            h('strong', null, info.shortLabel),
            h('p', null, info.description),
            h('p', null, t('info.security')),
            h('p', { className: 'warn' }, t('info.warning')),
          ),
          h('div', { className: 'dshOauthLabel' }, t('actions.label')),
          h('div', { className: 'dshOauthActions' },
            authorized
              ? h('button', { type: 'button', className: 'dshOauthButton danger', disabled: busy, onClick: logout }, t('actions.logout'))
              : h('form', {
                  method: 'post',
                  target: `dsh-oauth-${provider}`,
                  action: `/oauth-models/login?provider=${encodeURIComponent(provider)}&lang=${activeLocale}`,
                  onSubmit: () => window.setTimeout(() => void refresh(true), 1200),
                }, h('button', { type: 'submit', className: 'dshOauthButton', disabled: busy || waiting }, waiting ? t('actions.waiting') : t('actions.login'))),
            h('button', {
              type: 'button',
              className: 'dshOauthButton secondary',
              disabled: busy || !authorized || !model,
              onClick: setCurrentModel,
            }, t('actions.setModel')),
            h('button', { type: 'button', className: 'dshOauthButton secondary', disabled: busy, onClick: () => void refresh() }, t('actions.refresh')),
          ),
          status.manualInputRequired
            ? h('div', { className: 'dshOauthManual' },
                h('strong', null, t('manual.title')),
                h('p', null, t('manual.help')),
                h('form', { className: 'dshOauthManualForm', onSubmit: completeRemoteAuthorization },
                  h('input', {
                    className: 'dshOauthManualInput',
                    type: 'text',
                    value: manualInput,
                    placeholder: t('manual.placeholder'),
                    autoComplete: 'off',
                    spellCheck: false,
                    'aria-label': t('manual.title'),
                    onChange: event => setManualInputs(previous => ({ ...previous, [provider]: event.target.value })),
                  }),
                  h('button', {
                    type: 'submit',
                    className: 'dshOauthButton',
                    disabled: busy || manualInput.trim().length === 0,
                  }, t('manual.submit')),
                ),
              )
            : null,
          h('div', { className: 'dshOauthLabel' }, t('current.label')),
          h('div', { className: 'dshOauthCurrent' }, currentText),
        ),
        error ? h('p', { className: 'dshOauthError' }, error) : null,
        saved ? h('p', { className: 'dshOauthSaved' }, saved) : null,
        h('p', { className: 'dshOauthFoot' }, t('foot', {
          codex: groups['openai-codex']?.models?.length ?? 0,
          claude: groups.anthropic?.models?.length ?? 0,
        })),
      )
    }

    const inject = ['slots', 'locale']

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-oauth-models: 中英文字典')
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'oauth-models',
        order: 11,
        label: () => t('nav'),
        locale: NS,
        inject: () => ({ locale: ctx.locale }),
      }, OAuthModelsSection))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
