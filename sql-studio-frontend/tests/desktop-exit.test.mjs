import assert from 'node:assert/strict'
import test from 'node:test'

import { runDesktopExit } from '../src/pages/workspace/utils/desktopExit/index.ts'

function fixture(overrides = {}) {
  const events = []
  const page = { id: 'query', kind: 'query', title: '查询 1', connectionId: 'a', database: 'db', table: '', sql: 'old' }
  const state = {
    version: 1,
    tabs: [page, { ...page, id: 'unloaded', title: '查询 2', sql: '' }, { ...page, id: 'data', kind: 'data', sql: 'SELECT preview;' }, { ...page, id: 'design', kind: 'table-design', sql: '' }],
    activeTab: 'query',
    runs: { query: { source: 'fixture' } },
    resultViews: { query: { search: '', page: 1, resultIndex: 0 } },
    editorLayouts: { query: { anchor: 1, head: 1, top: 20, left: 0 } },
    explorer: { expanded: ['connection:a'], selected: ['table:a'], search: 'draft', top: 200 },
    resultHeight: 200,
    openedConnections: ['a'],
    runningTabId: ''
  }
  const options = {
    snapshot: () => state,
    flushEditor: () => {
      events.push('editor')
      state.tabs[0].sql = 'SELECT latest;'
    },
    draftsFor: async (pages) => {
      events.push('drafts')
      return pages.map((page) => (page.id === 'unloaded' ? { ...page, sql: 'SELECT unloaded;' } : page))
    },
    decide: async (sql) => {
      events.push(['confirm', sql])
      return 'exit'
    },
    exportSQL: async (sql) => events.push(['export', sql]),
    setClosing: (value) => events.push(['closing', value]),
    stop: () => events.push('stop'),
    waitForIdle: async () => events.push('idle'),
    persist: async (snapshot) => events.push(['persist', structuredClone(snapshot)]),
    connections: () => [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ],
    closeConnection: async (id) => events.push(['close', id]),
    clearWorkspace: (empty) => {
      events.push('clear')
      Object.assign(state, empty)
    },
    ...overrides
  }
  return { state, events, options }
}

test('全部查询参与确认，取消不停止请求、不关闭连接、不保存退出索引', async () => {
  const f = fixture({
    decide: async (sql) => {
      assert.match(sql, /SELECT latest;/)
      assert.match(sql, /SELECT unloaded;/)
      return 'cancel'
    }
  })
  assert.equal(await runDesktopExit(f.options), false)
  assert.deepEqual(f.events, ['editor', 'drafts'])
})

test('退出前同步最新草稿，全部连接关闭后提交空索引再清除所有类型的标签', async () => {
  const f = fixture()
  assert.equal(await runDesktopExit(f.options), true)
  const writes = f.events.filter((event) => Array.isArray(event) && event[0] === 'persist')
  assert.equal(writes.length, 2)
  assert.equal(writes[0][1].tabs[0].sql, 'SELECT latest;')
  assert.deepEqual(writes[1][1].openedConnections, [])
  assert.equal(writes[1][1].runningTabId, '')
  assert.deepEqual(writes[1][1].tabs, [])
  assert.equal(writes[1][1].activeTab, '')
  assert.deepEqual(writes[1][1].runs, {})
  assert.deepEqual(writes[1][1].resultViews, {})
  assert.deepEqual(writes[1][1].editorLayouts, {})
  assert.deepEqual(writes[1][1].explorer, { expanded: [], selected: [], search: '', top: 0 })
  assert.deepEqual(f.state.tabs, [])
  assert.equal(f.state.resultHeight, 200)
  assert.equal(f.events.at(-1), 'clear')
  assert.ok(f.events.indexOf('clear') > f.events.indexOf(writes[1]))
  assert.ok(f.events.indexOf('idle') < f.events.indexOf(writes[0]))
  assert.ok(f.events.findIndex((event) => event[0] === 'close') > f.events.indexOf(writes[0]))
  assert.equal(
    f.events.some((event) => Array.isArray(event) && event[0] === 'closing' && event[1] === false),
    false
  )
})

test('退出保留默认及自定义分组的展开或收起状态，只清理连接及数据库后代', async () => {
  const defaultGroup = JSON.stringify(['group', '默认分组'])
  const customGroup = JSON.stringify(['group', '开发: "数据库"'])
  for (const defaultExpanded of [true, false]) {
    for (const customExpanded of [true, false]) {
      const f = fixture()
      const groups = [...(defaultExpanded ? [defaultGroup] : []), ...(customExpanded ? [customGroup] : [])]
      const before = [
        JSON.stringify(['connection', 'a']),
        ...groups,
        JSON.stringify(['database', 'a', 'db']),
        JSON.stringify(['schema', 'a', 'db', 'public']),
        JSON.stringify(['tables', 'a', 'db']),
        JSON.stringify(['table', 'a', 'db', 'table']),
        JSON.stringify(['columns', 'a', 'db', 'table']),
        'invalid',
        JSON.stringify(['group']),
        JSON.stringify(['group', 1]),
        JSON.stringify(['group', 'extra', 'part'])
      ]
      f.state.explorer.expanded = [...before]
      assert.equal(await runDesktopExit(f.options), true)
      const writes = f.events.filter((event) => Array.isArray(event) && event[0] === 'persist')
      assert.deepEqual(writes[0][1].explorer.expanded, before)
      assert.deepEqual(writes[1][1].explorer.expanded, groups)
      assert.deepEqual(f.state.explorer.expanded, groups)
      assert.deepEqual(f.state.explorer.selected, [])
      assert.deepEqual(f.state.openedConnections, [])
      assert.deepEqual(f.state.tabs, [])
    }
  }
})

test('文件导出取消或草稿读取失败会保留整个窗口及连接', async () => {
  for (const overrides of [
    {
      decide: async () => 'save',
      exportSQL: async () => {
        throw new DOMException('cancelled', 'AbortError')
      }
    },
    {
      draftsFor: async () => {
        throw new Error('read failed')
      }
    }
  ]) {
    const f = fixture(overrides)
    await assert.rejects(runDesktopExit(f.options))
    assert.equal(
      f.events.some((event) => event === 'stop' || event[0] === 'close' || event[0] === 'persist'),
      false
    )
  }
})

test('保存失败或冲突不关闭任何连接，关闭失败仍尝试其余连接并恢复界面', async () => {
  const save = fixture({
    persist: async () => {
      throw new Error('conflict')
    }
  })
  await assert.rejects(runDesktopExit(save.options), /conflict/)
  assert.equal(
    save.events.some((event) => event[0] === 'close'),
    false
  )
  assert.deepEqual(save.events.at(-1), ['closing', false])
  const f = fixture()
  f.options.closeConnection = async (id) => {
    f.events.push(['close', id])
    if (id === 'a') throw new Error('release failed')
  }
  await assert.rejects(runDesktopExit(f.options), /A: release failed/)
  assert.deepEqual(
    f.events.filter((event) => event[0] === 'close'),
    [
      ['close', 'a'],
      ['close', 'b']
    ]
  )
  assert.deepEqual(f.events.at(-1), ['closing', false])
  assert.equal(f.events.filter((event) => event[0] === 'persist').length, 1)
  assert.equal(f.state.tabs.length, 4)
  assert.equal(f.events.includes('clear'), false)
})

test('最终空工作区保存失败时不移除内存标签；空 SQL 查询也参与保存决定', async () => {
  const failed = fixture({
    persist: async (value) => {
      if (!value.tabs.length) throw new Error('empty index failed')
    }
  })
  await assert.rejects(runDesktopExit(failed.options), /empty index failed/)
  assert.equal(failed.state.tabs.length, 4)
  assert.equal(failed.events.includes('clear'), false)
  assert.deepEqual(failed.events.at(-1), ['closing', false])
  const blank = fixture({ flushEditor() {}, draftsFor: async (pages) => pages.map((page) => ({ ...page, sql: '' })) })
  blank.options.decide = async (sql, pages) => {
    assert.equal(sql, '')
    assert.equal(pages.length, 2)
    return 'save'
  }
  assert.equal(await runDesktopExit(blank.options), true)
  assert.ok(blank.events.some((event) => Array.isArray(event) && event[0] === 'export' && event[1] === ''))
})

test('关闭回执与最终保存是退出屏障，连接去重且并发最多为4', async () => {
  let active = 0,
    maximum = 0,
    finalSaved = false
  const ids = []
  const f = fixture({
    connections: () => [...Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: String(i) })), { id: '0', name: 'duplicate' }],
    closeConnection: async (id) => {
      active++
      maximum = Math.max(maximum, active)
      ids.push(id)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active--
    },
    persist: async (snapshot) => {
      if (!snapshot.openedConnections.length) {
        assert.equal(ids.length, 9)
        assert.equal(active, 0)
        await new Promise((resolve) => setTimeout(resolve, 2))
        finalSaved = true
      }
    }
  })
  assert.equal(await runDesktopExit(f.options), true)
  assert.equal(maximum, 4)
  assert.equal(finalSaved, true)
  assert.equal(new Set(ids).size, 9)
})
