import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { setImmediate as settle } from 'node:timers/promises'

import ts from 'typescript'

function harness(modulePath, failWrite = false) {
  const slots = [],
    effects = []
  let cursor = 0,
    effectCursor = 0
  const writes = [],
    discovered = [],
    notifications = []
  const browser = new EventTarget()
  browser.addEventListener('ai-settings-saved', () => notifications.push('saved'))
  let document = { revision: 7, data: { provider: 'deepseek', configured: true, model: 'deepseek-flash', completionEnabled: false } }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [
        slots[index],
        (value) => {
          slots[index] = typeof value === 'function' ? value(slots[index]) : value
        }
      ]
    },
    useRef(initial) {
      const index = cursor++
      slots[index] ??= { current: initial }
      return slots[index]
    },
    useEffect(callback, dependencies) {
      const index = effectCursor++
      const previous = effects[index]
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        previous?.cleanup?.()
        effects[index] = { dependencies, cleanup: callback() }
      }
    },
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback
  }
  const request = async (path, options = {}) => {
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body)
      writes.push(body)
      if (failWrite) throw new Error('配置保存冲突')
      assert.equal(body.revision, document.revision)
      document = { revision: document.revision + 1, data: { ...document.data, ...body.data } }
    }
    return structuredClone(document)
  }
  const adapter = {
    profile: { value: 'deepseek', defaultModel: 'deepseek-flash' },
    listModels: async (key, signal) => {
      discovered.push({ key, signal })
      return [
        { id: 'deepseek-flash', name: 'DeepSeek Flash' },
        { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
      ]
    }
  }
  const dependencies = {
    react,
    '@/ai': { aiProviders: [{ value: 'deepseek' }], getAIAdapter: () => adapter, isAIProvider: (value) => value === 'deepseek' },
    '@/utils/request': { request },
    '@/databases': { getDatabaseAdapter: () => ({}) },
    '../../utils/aiCompletion': { aiCompletion: () => [] },
    '../../utils/aiContext': { buildAIContext: () => ({}) }
  }
  const source = readFileSync(new URL(modulePath, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('exports', 'require', 'window', compiled)(
    exports,
    (name) => {
      assert.ok(dependencies[name], '未提供依赖: ' + name)
      return dependencies[name]
    },
    browser
  )
  return {
    writes,
    discovered,
    notifications,
    get document() {
      return document
    },
    set document(value) {
      document = value
    },
    render(...args) {
      cursor = 0
      effectCursor = 0
      return (exports.useAISettings || exports.useAISQL)(...args)
    },
    close() {
      effects.forEach((effect) => effect.cleanup?.())
    }
  }
}

test('配置面板读取共享模型，保存只更新服务商、Key 和模型，不重置补全偏好或发送地址', async () => {
  const f = harness('../src/hooks/useAISettings/index.ts')
  try {
    await f.render().show()
    await settle()
    let model = f.render()
    assert.equal(model.configured, true)
    assert.equal(model.models.length, 2)
    model.setModel('deepseek-v4-pro')
    model = f.render()
    assert.equal(await model.save(), true)
    assert.deepEqual(f.writes[0].data, { provider: 'deepseek', model: 'deepseek-v4-pro', apiKey: '' })
    assert.equal(f.document.data.completionEnabled, false)
    assert.equal(f.document.data.model, 'deepseek-v4-pro')
    assert.equal(f.notifications.length, 1)
    assert.equal(f.discovered[0].key, '')
  } finally {
    f.close()
  }
})

test('首次配置填写 Key 后加载模型并保存选择，不发送额外字段', async () => {
  const f = harness('../src/hooks/useAISettings/index.ts')
  try {
    f.document = { revision: 0, data: null }
    await f.render().show()
    let model = f.render()
    assert.equal(model.configured, false)
    assert.equal(f.discovered.length, 0)
    model.changeKey(' fixture-only-key ')
    await f.render().refreshModels()
    model = f.render()
    model.setModel('deepseek-v4-pro')
    assert.equal(await f.render().save(), true)
    assert.equal(f.discovered[0].key, 'fixture-only-key')
    assert.deepEqual(f.writes[0], { revision: 0, data: { provider: 'deepseek', model: 'deepseek-v4-pro', apiKey: 'fixture-only-key' } })
  } finally {
    f.close()
  }
})

test('补全开关按最新修订保存，保留已选模型并广播共享配置更新', async () => {
  const f = harness('../src/pages/workspace/hooks/useAISQL/index.ts')
  const args = [{ connectionId: '', database: '', table: '', sql: 'SELECT 1' }, { snapshots: {} }, false]
  try {
    f.render(...args)
    await settle()
    const model = f.render(...args)
    assert.equal(model.configured, true)
    assert.equal(model.enabled, false)
    f.document = { revision: 9, data: { ...f.document.data, model: 'deepseek-v4-pro' } }
    await model.changeCompletion(true)
    assert.deepEqual(f.writes[0], { revision: 9, data: { provider: 'deepseek', completionEnabled: true } })
    assert.equal(f.document.data.model, 'deepseek-v4-pro')
    assert.equal(f.notifications.length, 1)
    assert.equal(f.render(...args).enabled, true)
  } finally {
    f.close()
  }
})

test('模型未选择时隐藏 AI 工具，补全保存失败保留原偏好并显示错误', async () => {
  const f = harness('../src/pages/workspace/hooks/useAISQL/index.ts', true)
  const args = [{ connectionId: '', database: '', table: '', sql: '' }, { snapshots: {} }, false]
  try {
    f.render(...args)
    await settle()
    let model = f.render(...args)
    await model.changeCompletion(true)
    model = f.render(...args)
    assert.equal(model.enabled, false)
    assert.match(model.preferenceError, /配置保存冲突/)
    assert.equal(f.notifications.length, 0)
  } finally {
    f.close()
  }
  const missing = harness('../src/pages/workspace/hooks/useAISQL/index.ts')
  try {
    missing.document = { revision: 1, data: { provider: 'deepseek', configured: true, model: '' } }
    missing.render(...args)
    await settle()
    assert.equal(missing.render(...args).configured, false)
  } finally {
    missing.close()
  }
})
