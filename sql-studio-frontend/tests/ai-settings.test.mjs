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
  let document = { revision: 7, data: { configurations: [{ id: 'a', provider: 'deepseek', model: 'deepseek-flash', modelName: 'Flash', configured: true }], activeId: 'a', completionEnabled: false } }
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
    assert.equal(path, '/state/ai-models', '模型配置只访问新分区')
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body)
      writes.push(body)
      if (failWrite) throw new Error('配置保存冲突')
      assert.equal(body.revision, document.revision)
      const data = { ...document.data, ...body.data }
      if (body.data.configurations) {
        data.configurations = body.data.configurations.map(({ id, provider, model, modelName }) => ({ id, provider, model, modelName, configured: true }))
      }
      document = { revision: document.revision + 1, data }
    }
    return structuredClone(document)
  }
  const adapter = {
    profile: { value: 'deepseek', defaultModel: 'deepseek-flash' },
    listModels: async (key, signal, configId) => {
      discovered.push({ key, signal, configId })
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
    '@/ai/typings': { maxAIConfigurations: 64, aiModelsSection: 'ai-models' },
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
    notifySettingsSaved() {
      browser.dispatchEvent(new Event('ai-settings-saved'))
    },
    render(...args) {
      cursor = 0
      effectCursor = 0
      return (exports.useAISettings || exports.useAISQL || exports.useModelEditor)(...args)
    },
    close() {
      effects.forEach((effect) => effect.cleanup?.())
    }
  }
}

const availableModels = [
  { id: 'deepseek-flash', name: 'Flash' },
  { id: 'deepseek-v4-pro', name: 'Pro' }
]
const entry = (id, model, apiKey = '') => ({
  id,
  provider: 'deepseek',
  model,
  modelName: availableModels.find((value) => value.id === model)?.name || '',
  apiKey,
  configured: !apiKey,
  models: availableModels,
  modelsLoading: false,
  modelsError: ''
})

test('新格式保存模型显示名称和列表，不包含旧配置字段；每条记录可测试连接', async () => {
  const f = harness('../src/hooks/useAISettings/index.ts')
  try {
    await f.render().show()
    const existing = f.render().entries[0]
    assert.equal(existing.modelName, 'Flash')
    assert.equal(f.render().activeId, 'a')
    await f.render().testConnection(existing.id)
    assert.equal(f.render().connectionTests.a.success, true)
    assert.equal(f.discovered[0].configId, 'a')
    assert.equal(f.discovered[0].key, '')
    assert.equal(f.render().upsertEntry({ ...existing, model: 'deepseek-v4-pro', modelName: 'Pro', models: availableModels }), true)
    assert.equal(await f.render().save(), true)
    assert.deepEqual(f.writes[0].data, { activeId: 'a', configurations: [{ id: 'a', provider: 'deepseek', model: 'deepseek-v4-pro', modelName: 'Pro', apiKey: '' }] })
    assert.equal(f.document.data.completionEnabled, false)
    assert.equal(f.render().changed, false)
  } finally {
    f.close()
  }
})

test('首个添加的模型为默认，列表可切换，移除默认后选剩余首项', async () => {
  const f = harness('../src/hooks/useAISettings/index.ts')
  try {
    f.document = { revision: 0, data: null }
    await f.render().show()
    assert.equal(f.render().ready, true)
    assert.equal(f.render().error, '')
    assert.equal(f.render().upsertEntry(entry('a', '', 'fixture-key-a')), false)
    assert.equal(f.render().upsertEntry(entry('a', 'deepseek-flash', 'fixture-key-a')), true)
    assert.equal(f.render().upsertEntry(entry('b', 'deepseek-v4-pro', 'fixture-key-b')), true)
    assert.equal(f.render().upsertEntry(entry('c', 'deepseek-flash', 'fixture-key-c')), false)
    assert.equal(f.render().entries.length, 2)
    assert.equal(f.render().activeId, 'a')
    assert.equal(await f.render().save(), true)
    assert.equal(f.document.data.activeId, 'a')
    f.render().selectActive('unknown')
    assert.equal(f.render().activeId, 'a')
    f.render().selectActive('b')
    assert.equal(f.render().changed, true)
    assert.equal(await f.render().save(), true)
    assert.equal(f.document.data.activeId, 'b')
    f.render().removeEntry('b')
    assert.equal(f.render().activeId, 'a')
    assert.equal(await f.render().save(), true)
    assert.equal(f.document.data.activeId, 'a')
    assert.equal('provider' in f.writes[0].data, false)
  } finally {
    f.close()
  }
})

test('旧单条格式不转换为列表', async () => {
  const f = harness('../src/hooks/useAISettings/index.ts')
  try {
    f.document = { revision: 1, data: { provider: 'deepseek', model: 'old-model', configured: true } }
    await f.render().show()
    assert.equal(f.render().ready, false)
    assert.equal(f.render().entries.length, 0)
    assert.match(f.render().error, /配置列表无效/)
  } finally {
    f.close()
  }
})

test('添加弹框测试连接不自动选择模型，重复供应商模型不可提交', async () => {
  const selected = []
  const f = harness('../src/components/aiSettings/hooks/useModelEditor/index.ts')
  const configured = [entry('saved', 'deepseek-flash')]
  const args = [
    configured,
    (value) => {
      selected.push(value)
      return true
    }
  ]
  try {
    f.render(...args).show()
    f.render(...args).changeProvider('deepseek')
    f.render(...args).changeKey('fixture-new-key')
    await f.render(...args).refreshModels()
    assert.equal(f.render(...args).draft.model, '')
    assert.equal(f.render(...args).canCommit, false)
    f.render(...args).changeModel('deepseek-flash')
    assert.equal(f.render(...args).duplicate, true)
    assert.equal(f.render(...args).canCommit, false)
    f.render(...args).changeModel('deepseek-v4-pro')
    assert.equal(f.render(...args).canCommit, true)
    f.render(...args).commit()
    assert.equal(selected[0].model, 'deepseek-v4-pro')
    assert.equal(f.render(...args).draft, null)
    assert.equal(f.discovered[0].key, 'fixture-new-key')
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
    f.document = { revision: 9, data: { ...f.document.data, configurations: [{ id: 'a', provider: 'deepseek', model: 'deepseek-v4-pro', modelName: 'Pro', configured: true }] } }
    await model.changeCompletion(true)
    assert.deepEqual(f.writes[0], { revision: 9, data: { activeId: 'a', completionEnabled: true, configurations: [{ id: 'a', provider: 'deepseek', model: 'deepseek-v4-pro', modelName: 'Pro' }] } })
    assert.equal(f.document.data.configurations[0].model, 'deepseek-v4-pro')
    assert.equal(f.notifications.length, 1)
    assert.equal(f.render(...args).enabled, true)
  } finally {
    f.close()
  }
})

test('补全保存失败保留原偏好并显示错误', async () => {
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
})

test('已保存模型时显示 SQL AI 工具，选中当前模型后才可使用', async () => {
  const f = harness('../src/pages/workspace/hooks/useAISQL/index.ts')
  const args = [{ connectionId: '', database: '', table: '', sql: '' }, { snapshots: {} }, false]
  try {
    const saved = f.document
    f.document = { revision: 0, data: null }
    f.render(...args)
    await settle()
    assert.equal(f.render(...args).hasSavedModel, false)

    f.document = { ...saved, data: { ...saved.data, activeId: '' } }
    f.notifySettingsSaved()
    await settle()
    let model = f.render(...args)
    assert.equal(model.hasSavedModel, true)
    assert.equal(model.configured, false)
    await model.changeCompletion(true)
    assert.equal(f.writes.length, 0)

    f.document = { ...saved, revision: saved.revision + 1 }
    f.notifySettingsSaved()
    await settle()
    model = f.render(...args)
    assert.equal(model.hasSavedModel, true)
    assert.equal(model.configured, true)
    assert.equal(model.enabled, false)
  } finally {
    f.close()
  }
})
