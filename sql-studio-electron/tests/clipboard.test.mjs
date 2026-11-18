import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { createClipboardWriter } from '../src/clipboard.mjs'

test('原生复制保持完整文本、换行和空字符串', () => {
  const writes = []
  const write = createClipboardWriter(
    (text) => writes.push(text),
    () => true
  )
  for (const text of ['-- 注释\nSELECT 1;\n', '  中文\tvalue  ', '']) {
    assert.equal(write({}, text), true)
    assert.equal(writes.at(-1), text)
  }
})

test('拒绝非工作台请求和非文本值，不访问剪贴板', () => {
  const workbench = {}
  let calls = 0
  const write = createClipboardWriter(
    () => calls++,
    (event) => event === workbench
  )
  assert.equal(write({}, 'SELECT 1;'), false)
  for (const value of [null, undefined, 1, {}, ['SQL']]) assert.equal(write(workbench, value), false)
  assert.equal(calls, 0)
})

test('系统写入失败静默返回 false，后续复制仍可成功', () => {
  let busy = true
  const write = createClipboardWriter(
    () => {
      if (busy) throw new Error('clipboard unavailable')
    },
    () => true
  )
  assert.equal(write({}, 'SQL'), false)
  busy = false
  assert.equal(write({}, 'SQL'), true)
})

test('preload 仅转发文本写入 IPC 并返回成功状态', async () => {
  let bridge
  const calls = []
  new Function('require', 'process', readFileSync(new URL('../src/preload.cjs', import.meta.url), 'utf8'))(
    () => ({
      contextBridge: {
        exposeInMainWorld: (_name, value) => {
          bridge = value
        }
      },
      ipcRenderer: {
        invoke: async (...args) => {
          calls.push(args)
          return true
        }
      }
    }),
    { platform: 'win32' }
  )
  assert.equal(await bridge.writeClipboardText('SELECT 1;\n'), true)
  assert.deepEqual(calls, [['sql-studio:write-clipboard-text', 'SELECT 1;\n']])
})
