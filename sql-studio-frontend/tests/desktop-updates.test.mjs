import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { setImmediate as settle } from 'node:timers/promises'

import ts from 'typescript'

const source = readFileSync(new URL('../src/components/systemSettings/hooks/useDesktopUpdates/index.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

function harness(desktop) {
  const slots = [],
    effects = []
  let cursor = 0,
    effectCursor = 0
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [
        slots[index],
        (value) => {
          slots[index] = typeof value === 'function' ? value(slots[index]) : value
        }
      ]
    },
    useRef(initial) {
      const index = cursor++
      return (slots[index] ??= { current: initial })
    },
    useCallback(callback, dependencies) {
      const index = cursor++
      if (!slots[index] || dependencies.some((value, i) => value !== slots[index].dependencies[i])) slots[index] = { callback, dependencies }
      return slots[index].callback
    },
    useEffect(callback, dependencies) {
      const index = effectCursor++
      if (!effects[index] || dependencies.some((value, i) => value !== effects[index].dependencies[i])) {
        effects[index]?.cleanup?.()
        effects[index] = { dependencies, cleanup: callback() }
      }
    }
  }
  const exports = {}
  new Function('exports', 'require', 'window', compiled)(exports, () => react, { sqlStudioDesktop: desktop })
  return {
    render() {
      cursor = 0
      effectCursor = 0
      return exports.useDesktopUpdates()
    },
    close() {
      for (const effect of effects) effect?.cleanup?.()
    }
  }
}

test('实时进度优先于迟到的初始快照，关页注销，重开恢复完成状态', async () => {
  const listeners = new Set()
  let resolveInitial,
    reads = 0
  let current = { revision: 4, pending: 'download', result: { status: 'available', version: '2.0.0', canDownload: true }, progress: { percent: 60, transferred: 60, total: 100, bytesPerSecond: 20 } }
  const desktop = {
    updates: {
      onState(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      getState: () =>
        ++reads === 1
          ? new Promise((resolve) => {
              resolveInitial = resolve
            })
          : Promise.resolve(current)
    }
  }
  const f = harness(desktop)
  f.render()
  for (const listener of listeners) listener(current)
  resolveInitial({ revision: 2, result: { status: 'upToDate' } })
  await settle()
  assert.equal(f.render().progress.percent, 60)
  assert.equal(f.render().pending, 'download')
  assert.equal(listeners.size, 1)
  f.close()
  assert.equal(listeners.size, 0)
  current = { revision: 5, result: { status: 'downloaded', version: '2.0.0' }, progress: { percent: 100, transferred: 100, total: 100, bytesPerSecond: 0 } }
  const reopened = harness(desktop)
  reopened.render()
  await settle()
  assert.equal(reopened.render().result.status, 'downloaded')
  assert.equal(reopened.render().progress.percent, 100)
  assert.equal(reopened.render().pending, undefined)
  reopened.close()
})

test('后台下载失败恢复错误与进度，浏览器无桌面桥接时不订阅', async () => {
  const f = harness({
    updates: {
      onState: () => () => {},
      getState: async () => ({ revision: 3, error: { action: 'download', code: 'UPDATE_NETWORK' }, progress: { percent: 40, transferred: 40, total: 100, bytesPerSecond: 0 } })
    }
  })
  f.render()
  await settle()
  assert.equal(f.render().downloadFailed, true)
  assert.match(f.render().error, /代理或网络/)
  assert.equal(f.render().progress.percent, 40)
  f.close()
  assert.equal(harness(undefined).render().desktop, false)
})
