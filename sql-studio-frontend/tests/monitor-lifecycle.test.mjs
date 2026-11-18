import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import ts from 'typescript'

import { isMonitorReset, sampleValue } from '../src/utils/monitorMetrics/index.ts'

const connection = { id: 'a', type: 'mysql', name: 'fixture' }
const sample = (index) => ({
  sampledAt: new Date(1700000000000 + index * 1000).toISOString(),
  metrics: [
    { key: 'uptime', value: String(100 + index) },
    { key: 'commands', value: String(index * 10) }
  ]
})

function harness(connections = [connection]) {
  const slots = [],
    effects = [],
    calls = [],
    timers = new Map()
  let cursor = 0,
    dirty = true,
    model,
    sequence = 0
  const useEffect = (callback, dependencies) => {
    const index = cursor++
    const previous = slots[index]
    if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return
    const entry = { dependencies }
    slots[index] = entry
    effects.push(() => {
      previous?.cleanup?.()
      entry.cleanup = callback()
    })
  }
  const react = {
    useEffect,
    useLayoutEffect: useEffect,
    useRef(initial) {
      const index = cursor++
      slots[index] ??= { current: initial }
      return slots[index]
    },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [
        slots[index],
        (value) => {
          const next = typeof value === 'function' ? value(slots[index]) : value
          if (!Object.is(next, slots[index])) {
            slots[index] = next
            dirty = true
          }
        }
      ]
    }
  }
  const api = {
    getDatabases: async () => [],
    getDatabaseMonitor: (id, database, signal) => new Promise((resolve, reject) => calls.push({ id, database, signal, resolve, reject }))
  }
  const window = {
    setTimeout(callback, delay) {
      const id = ++sequence
      timers.set(id, { callback, delay })
      return id
    },
    clearTimeout(id) {
      timers.delete(id)
    }
  }
  const dependencies = {
    react,
    '@/services/database': api,
    '@/databases/typings': { DatabaseEngine: { PostgreSQL: 'postgresql', GreptimeDB: 'greptimedb' } },
    '@/utils/monitorMetrics': { isMonitorReset }
  }
  const source = readFileSync(new URL('../src/pages/databaseMonitor/hooks/useDatabaseMonitor/index.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('exports', 'require', 'window', compiled)(
    exports,
    (name) => {
      assert.ok(dependencies[name], name)
      return dependencies[name]
    },
    window
  )
  const flush = async () => {
    for (let i = 0; i < 12; i++) {
      if (dirty) {
        dirty = false
        cursor = 0
        model = exports.useDatabaseMonitor(connections, undefined, '')
        effects.splice(0).forEach((effect) => effect())
      }
      await Promise.resolve()
    }
    return model
  }
  return {
    calls,
    timers,
    flush,
    get model() {
      return model
    },
    update: async (next) => {
      connections = next
      dirty = true
      await flush()
    },
    resolve: async (index, value) => {
      calls[index].resolve(value)
      await flush()
    },
    reject: async (index) => {
      calls[index].reject(new Error('temporarily unavailable'))
      await flush()
    },
    tick: async (delay) => {
      const timer = [...timers].find(([, value]) => value.delay === delay)
      assert.ok(timer, 'expected scheduled interval ' + delay)
      timers.delete(timer[0])
      timer[1].callback()
      await flush()
    },
    close: () => slots.forEach((entry) => entry?.cleanup?.())
  }
}

test('进入立即采样，1秒补齐速率基线，之后每5秒刷新且慢请求不重叠', async () => {
  const f = harness()
  try {
    await f.flush()
    assert.equal(f.calls.length, 1)
    assert.equal(f.model.refreshInterval, 5)
    await f.resolve(0, sample(0))
    assert.equal(f.model.result.history.length, 1)
    await f.tick(1000)
    assert.equal(f.calls.length, 2)
    assert.equal(f.timers.size, 0, 'an unfinished request schedules no overlapping request')
    await f.resolve(1, sample(1))
    assert.equal(sampleValue(f.model.result.history, 1, { key: 'commands', source: 'counter' }), '10')
    await f.tick(5000)
    assert.equal(f.calls.length, 3)
    assert.equal(f.timers.size, 0)
  } finally {
    f.close()
  }
  assert.equal(f.timers.size, 0)
  assert.equal(f.calls.at(-1).signal.aborted, true)
})

test('连接列表延迟到达自动开始，同一连接对象重建不取消请求或重启采样', async () => {
  const f = harness([])
  try {
    await f.flush()
    assert.equal(f.calls.length, 0)
    await f.update([connection])
    assert.equal(f.calls.length, 1)
    await f.update([{ ...connection }])
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].signal.aborted, false)
    await f.resolve(0, sample(0))
    assert.equal(f.model.result.snapshot.sampledAt, sample(0).sampledAt)
    await f.update([{ ...connection }])
    await f.tick(1000)
    assert.equal(f.calls.length, 2)
  } finally {
    f.close()
  }
})

test('首次采样失败也自动重试，成功后自动补齐第二个采样', async () => {
  const f = harness()
  try {
    await f.flush()
    await f.reject(0)
    assert.match(f.model.result.error, /temporarily unavailable/)
    await f.tick(5000)
    await f.resolve(1, sample(1))
    assert.equal(f.model.result.error, undefined)
    await f.tick(1000)
    await f.resolve(2, sample(2))
    assert.equal(f.model.result.history.length, 2)
  } finally {
    f.close()
  }
})

test('切换范围忽略迟到响应，关闭自动刷新清除计时，手动刷新仍立即采样', async () => {
  const second = { id: 'b', type: 'postgresql', name: 'other' }
  const f = harness([connection, second])
  try {
    await f.flush()
    f.model.selectConnection('b')
    await f.flush()
    assert.equal(f.calls[0].signal.aborted, true)
    f.model.selectDatabase('analytics')
    await f.flush()
    assert.equal(f.calls[1].signal.aborted, true)
    assert.deepEqual([f.calls[2].id, f.calls[2].database], ['b', 'analytics'])
    await f.resolve(0, sample(0))
    await f.resolve(1, sample(1))
    assert.equal(f.model.result, undefined)
    await f.resolve(2, sample(2))
    assert.equal(f.model.result.history.length, 1)
    f.model.setRefreshInterval(0)
    await f.flush()
    assert.equal(f.timers.size, 0)
    f.model.refresh()
    await f.flush()
    assert.equal(f.calls.length, 4)
    await f.resolve(3, sample(3))
    assert.equal(f.model.result.history.length, 2)
    assert.equal(f.timers.size, 0)
  } finally {
    f.close()
  }
})
