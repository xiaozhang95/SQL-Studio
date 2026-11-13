import assert from 'node:assert/strict'
import test from 'node:test'

import { createExportWriter } from '../src/utils/exportWriter/index.ts'
import { saveSQL } from '../src/utils/sqlSave/index.ts'

function bridge() {
  const calls = { begin: [], commit: [], discard: [] }
  return {
    calls,
    saveFile: {
      begin: async (filename) => {
        calls.begin.push(filename)
        return { canceled: false, id: 's1', filePath: 'C:/x/' + filename }
      },
      commit: async (id, data) => {
        calls.commit.push([id, data])
        return { filePath: 'C:/x/out.sql' }
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
    assert.deepEqual(b.calls.commit, [['s1', '结构\n数据\n']])
  } finally {
    globalThis.window = old
  }
})

test('桌面 begin 取消抛 AbortError，不进入导出', async () => {
  const old = globalThis.window
  globalThis.window = { sqlStudioDesktop: { saveFile: { begin: async () => ({ canceled: true }), commit: async () => ({}), discard: async () => {} } } }
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

test('saveSQL 桌面先 begin 后整段 commit', async () => {
  const old = globalThis.window
  const b = bridge()
  globalThis.window = { sqlStudioDesktop: b }
  try {
    await saveSQL('select 1;', 'a/b')
    assert.deepEqual(b.calls.begin, ['a_b.sql'])
    assert.deepEqual(b.calls.commit, [['s1', 'select 1;']])
  } finally {
    globalThis.window = old
  }
})