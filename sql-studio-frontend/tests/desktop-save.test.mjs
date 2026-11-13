import assert from 'node:assert/strict'
import test from 'node:test'

import { createExportWriter } from '../src/utils/exportWriter/index.ts'
import { saveSQL } from '../src/utils/sqlSave/index.ts'

function bridge() {
  const calls = { begin: [], append: [], commit: [], discard: [] }
  return {
    calls,
    saveFile: {
      begin: async (filename) => {
        calls.begin.push(filename)
        return { canceled: false, id: 's1', filePath: 'C:/x/' + filename }
      },
      append: async (id, bytes) => {
        calls.append.push([id, bytes])
      },
      commit: async (id) => {
        calls.commit.push(id)
      },
      discard: async (id) => {
        calls.discard.push(id)
      }
    }
  }
}

test('桌面创建即 begin 选路径，close 才 commit 落盘', async () => {
  const old = globalThis.window
  const b = bridge()
  globalThis.window = { sqlStudioDesktop: b }
  try {
    const output = await createExportWriter('a/b')
    assert.deepEqual(b.calls.begin, ['a_b.sql'])
    assert.equal(output.destination, 'C:/x/a_b.sql')
    await output.write('结构\n')
    await output.write('数据\n')
    assert.equal(b.calls.commit.length, 0)
    await output.close()
    assert.deepEqual(
      b.calls.append.map(([id, bytes]) => [id, new TextDecoder().decode(bytes)]),
      [
        ['s1', '结构\n'],
        ['s1', '数据\n']
      ]
    )
    assert.deepEqual(b.calls.commit, ['s1'])
  } finally {
    globalThis.window = old
  }
})

test('桌面 begin 取消抛 AbortError，不进入导出', async () => {
  const old = globalThis.window
  globalThis.window = { sqlStudioDesktop: { saveFile: { begin: async () => ({ canceled: true }), append: async () => {}, commit: async () => ({}), discard: async () => {} } } }
  try {
    await assert.rejects(createExportWriter('a/b'), (error) => error.name === 'AbortError')
    await assert.rejects(saveSQL('select 1', 'a/b'), (error) => error.name === 'AbortError')
  } finally {
    globalThis.window = old
  }
})

test('桌面 abort 丢弃会话不 commit', async () => {
  const old = globalThis.window
  const b = bridge()
  globalThis.window = { sqlStudioDesktop: b }
  try {
    const output = await createExportWriter('a/b')
    await output.write('x')
    await output.abort()
    assert.deepEqual(b.calls.discard, ['s1'])
    assert.equal(b.calls.commit.length, 0)
  } finally {
    globalThis.window = old
  }
})

test('桌面落盘期间收到取消立即通知主进程，后续清理不重复发送', async () => {
  const old = globalThis.window
  const b = bridge()
  const controller = new AbortController()
  b.saveFile.commit = () =>
    new Promise((_resolve, reject) => {
      b.saveFile.discard = async (id) => {
        b.calls.discard.push(id)
        reject(new Error('取消保存'))
      }
    })
  globalThis.window = { sqlStudioDesktop: b }
  try {
    const output = await createExportWriter('example', 'zh-CN', controller.signal)
    await output.write('SELECT 1;')
    const close = output.close()
    controller.abort()
    await assert.rejects(close, /取消保存/)
    await output.abort()
    assert.deepEqual(b.calls.discard, ['s1'])
  } finally {
    globalThis.window = old
  }
})

test('saveSQL 保留导入文件名且分块不破坏 Unicode', async () => {
  const old = globalThis.window
  const b = bridge()
  globalThis.window = { sqlStudioDesktop: b }
  try {
    const sql = 'a'.repeat(1024 * 1024 - 1) + '😀;\n'
    await saveSQL(sql, 'a/b.sql')
    assert.deepEqual(b.calls.begin, ['a_b.sql'])
    assert.equal(b.calls.append.length, 2)
    assert.equal(b.calls.append.map(([, bytes]) => new TextDecoder().decode(bytes)).join(''), sql)
    assert.deepEqual(b.calls.commit, ['s1'])
  } finally {
    globalThis.window = old
  }
})
