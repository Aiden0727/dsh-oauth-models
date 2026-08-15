import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

function element(type, props, ...children) {
  return { type, props: props ?? {}, children: children.flat() }
}

function textOf(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(textOf).join(' ')
  return textOf(value.children)
}

function translate(dict, key, values = {}) {
  return String(dict[key] ?? key).replace(/\{([^}]+)\}/g, (_match, name) => String(values[name] ?? `{${name}}`))
}

test('registers balanced dictionaries and renders both languages', async () => {
  let definition
  const React = {
    createElement: element,
    useCallback: value => value,
    useEffect: () => undefined,
    useMemo: factory => factory(),
    useRef: value => ({ current: value }),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => undefined],
  }
  const window = {
    __ModuleLoader__: {
      load(value) {
        definition = value
      },
    },
    setInterval: () => 1,
    clearInterval: () => undefined,
    setTimeout: () => 1,
  }
  const document = {
    hidden: false,
    querySelector: () => ({}),
  }
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(source, /Complete remote authorization/u)
  assert.match(source, /\/oauth-models\/complete/u)
  assert.match(source, /localhost:1455\/auth\/callback/u)
  runInNewContext(source, { window, document, crypto: { randomUUID }, fetch, Intl, URL, console })
  const plugin = definition.factory(id => {
    if (id === 'react') return React
    throw new Error(`unexpected module: ${id}`)
  })

  let active = 'zh'
  let dictionaries
  let section
  const locale = {
    register(_namespace, value) {
      dictionaries = value
      return () => undefined
    },
    bind() {
      return (key, values) => translate(dictionaries[active], key, values)
    },
    getSnapshot() {
      return { active, revision: active === 'zh' ? 1 : 2 }
    },
    setLocale(next) {
      active = next
    },
  }
  const ctx = {
    locale,
    effect(setup) {
      return setup()
    },
    slots: {
      inject(_name, setup) {
        return setup()
      },
      register(options, component) {
        section = { options, component }
        return () => undefined
      },
    },
  }
  plugin.apply(ctx)

  assert.deepEqual(Object.keys(dictionaries.zh).sort(), Object.keys(dictionaries.en).sort())
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale'])
  assert.equal(section.options.locale, 'settings.oauthModels')
  assert.equal(section.options.label(), '账号授权')
  const injected = section.options.inject()
  const zhTree = section.component({ t: locale.bind(), ...injected })
  assert.match(textOf(zhTree), /AI 模型账号授权/)
  assert.match(textOf(zhTree), /推理强度/)
  assert.match(textOf(zhTree), /Speed/)

  active = 'en'
  assert.equal(section.options.label(), 'Account authorization')
  const enTree = section.component({ t: locale.bind(), ...injected })
  assert.match(textOf(enTree), /AI model account authorization/)
  assert.match(textOf(enTree), /Reasoning effort/)
  assert.match(textOf(enTree), /Speed/)
})
