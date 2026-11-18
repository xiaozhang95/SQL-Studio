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
    runs: { query: { source: 'fixture' }, unloaded: { source: 'unloaded' } },
    resultViews: { query: { search: '', page: 1, resultIndex: 0 }, unloaded: { search: 'keep', page: 2, resultIndex: 0 } },
    editorLayouts: { query: { anchor: 1, head: 1, top: 20, left: 0 }, unloaded: { anchor: 0, head: 0, top: 40, left: 0 } },
    explorer: { expanded: ['connection:a'], selected: ['table:a'], search: 'draft', top: 200 },
    resultHeight: 200,
    openedConnections: ['a'],
    runningTabId: ''
  }
  const options = {
    snapshot: () => state,
    flushEditor: () => {
      events.push(['editor', state.activeTab])
      const page = state.tabs.find((page) => page.id === 'query')
      if (page) page.sql = 'SELECT latest;'
    },
    draftsFor: async (pages) => {
      events.push(['drafts', pages.map((page) => page.id)])
      return pages.map((page) => (page.id === 'unloaded' ? { ...page, sql: 'SELECT unloaded;' } : page))
    },
    activatePage: async (id) => {
      events.push(['activate', id])
      state.activeTab = id
    },
    isDirty: () => false,
    decide: async (page) => {
      events.push(['confirm', structuredClone(page)])
      return 'exit'
    },
    exportSQL: async (sql, title) => events.push(['export', sql, title]),
    setPreparing: (value) => events.push(['preparing', value]),
    setClosing: (value) => events.push(['closing', value]),
    stop: () => {
      events.push(['stop', state.runningTabId])
      state.runningTabId = ''
    },
    waitForIdle: async () => events.push(['idle']),
    persist: async (snapshot) => events.push(['persist', structuredClone(snapshot)]),
    connections: () => [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ],
    closeConnection: async (id) => events.push(['close', id]),
    applyWorkspace: (next) => {
      events.push(['apply', structuredClone(next)])
      Object.assign(state, next)
    },
    ...overrides
  }
  return { state, events, options }
}

const eventsOf = (fixture, kind) => fixture.events.filter((event) => event[0] === kind)

test('首个确认取消保留当前和其余标签，不取消请求或关闭连接', async () => {
  const f = fixture({ decide: async () => 'cancel' })
  assert.equal(await runDesktopExit(f.options), false)
  assert.equal(f.state.tabs.length, 4)
  assert.equal(f.state.activeTab, 'query')
  for (const kind of ['stop', 'close', 'persist', 'apply']) assert.deepEqual(eventsOf(f, kind), [])
  assert.deepEqual(f.events.at(-1), ['preparing', false])
})

test('逐页保存原文和对应标题，关闭并切到下一页后继续询问；后续取消不恢复已关闭页', async () => {
  const f = fixture()
  f.options.decide = async (page) => {
    assert.equal(f.state.activeTab, page.id)
    if (page.kind !== 'query') return 'exit'
    f.events.push(['confirm', structuredClone(page)])
    if (page.id === 'query') return 'save'
    assert.equal(
      f.state.tabs.some((page) => page.id === 'query'),
      false
    )
    assert.equal(f.state.runs.query, undefined)
    assert.equal(f.state.resultViews.query, undefined)
    assert.equal(f.state.editorLayouts.query, undefined)
    assert.equal(f.state.runs.unloaded.source, 'unloaded')
    return 'cancel'
  }
  assert.equal(await runDesktopExit(f.options), false)
  assert.deepEqual(eventsOf(f, 'export'), [['export', 'SELECT latest;', '查询 1']])
  assert.deepEqual(
    eventsOf(f, 'confirm').map(([, page]) => page.id),
    ['query', 'unloaded']
  )
  assert.deepEqual(
    f.state.tabs.map((page) => page.id),
    ['unloaded', 'data', 'design']
  )
  assert.equal(f.state.activeTab, 'unloaded')
  assert.deepEqual(f.state.openedConnections, ['a'])
  assert.deepEqual(eventsOf(f, 'close'), [])
  assert.equal(eventsOf(f, 'persist').length, 1)
  assert.equal(eventsOf(f, 'persist')[0][1].activeTab, 'unloaded')
})

test('从当前标签依次处理右侧相邻页，再处理左侧剩余页', async () => {
  const f = fixture()
  f.state.activeTab = 'unloaded'
  assert.equal(await runDesktopExit(f.options), true)
  assert.deepEqual(
    eventsOf(f, 'activate').map(([, id]) => id),
    ['unloaded', 'data', 'design', 'query']
  )
  assert.deepEqual(
    eventsOf(f, 'confirm').map(([, page]) => page.id),
    ['unloaded', 'query']
  )
})

test('多个查询分别导出文件，全部标签关闭后才释放连接并保存最终索引', async () => {
  const f = fixture()
  f.options.decide = async (page) => (page.kind === 'query' ? 'save' : 'exit')
  assert.equal(await runDesktopExit(f.options), true)
  assert.deepEqual(eventsOf(f, 'export'), [
    ['export', 'SELECT latest;', '查询 1'],
    ['export', 'SELECT unloaded;', '查询 2']
  ])
  assert.deepEqual(eventsOf(f, 'drafts'), [
    ['drafts', ['query']],
    ['drafts', ['unloaded']]
  ])
  const writes = eventsOf(f, 'persist')
  assert.deepEqual(
    writes.map(([, value]) => value.tabs.length),
    [3, 2, 1, 0, 0, 0]
  )
  assert.ok(f.events.indexOf(eventsOf(f, 'close')[0]) > f.events.indexOf(writes[4]))
  const final = writes.at(-1)[1]
  assert.deepEqual(final.tabs, [])
  assert.equal(final.activeTab, '')
  for (const field of ['runs', 'resultViews', 'editorLayouts']) assert.deepEqual(final[field], {})
  assert.deepEqual(final.openedConnections, [])
  assert.deepEqual(final.explorer, { expanded: [], selected: [], search: '', top: 0 })
  assert.equal(f.state.resultHeight, 200)
  assert.deepEqual(eventsOf(f, 'apply').at(-1)[1], final)
})

test('空白查询和干净对象页直接关闭，未常驻草稿按真实内容判断', async () => {
  const f = fixture({ flushEditor() {}, draftsFor: async (pages) => pages.map((page) => ({ ...page, sql: ' \n\t ' })) })
  assert.equal(await runDesktopExit(f.options), true)
  assert.deepEqual(eventsOf(f, 'confirm'), [])
  assert.deepEqual(eventsOf(f, 'export'), [])
  const unloaded = fixture({ flushEditor() {} })
  unloaded.state.tabs[0].sql = '  '
  assert.equal(await runDesktopExit(unloaded.options), true)
  assert.deepEqual(
    eventsOf(unloaded, 'confirm').map(([, page]) => page.id),
    ['unloaded']
  )
})

test('后续文件选择取消保留该标签和剩余标签，已关闭标签不恢复', async () => {
  const f = fixture()
  f.options.decide = async (page) => (page.id === 'unloaded' ? 'save' : 'exit')
  f.options.exportSQL = async () => {
    throw new DOMException('cancelled', 'AbortError')
  }
  await assert.rejects(runDesktopExit(f.options), { name: 'AbortError' })
  assert.deepEqual(
    f.state.tabs.map((page) => page.id),
    ['unloaded', 'data', 'design']
  )
  assert.equal(f.state.activeTab, 'unloaded')
  assert.deepEqual(eventsOf(f, 'close'), [])
  assert.deepEqual(f.events.at(-1), ['preparing', false])
})

test('激活、读取或关闭索引保存失败保留当前标签，不删除未确认内容', async () => {
  for (const overrides of [
    {
      draftsFor: async () => {
        throw new Error('read failed')
      }
    },
    {
      activatePage: async () => {
        throw new Error('load failed')
      }
    },
    {
      persist: async () => {
        throw new Error('conflict')
      }
    }
  ]) {
    const f = fixture(overrides)
    await assert.rejects(runDesktopExit(f.options))
    assert.equal(f.state.tabs.length, 4)
    for (const kind of ['apply', 'close']) assert.deepEqual(eventsOf(f, kind), [])
    assert.deepEqual(f.events.at(-1), ['preparing', false])
  }
})

test('运行页确认后取消并等待该页请求，关闭其他页不提前取消后台任务', async () => {
  const f = fixture()
  f.state.runningTabId = 'unloaded'
  assert.equal(await runDesktopExit(f.options), true)
  const stop = eventsOf(f, 'stop')[0]
  assert.deepEqual(stop, ['stop', 'unloaded'])
  assert.ok(f.events.indexOf(stop) > f.events.indexOf(eventsOf(f, 'apply')[0]))
  assert.ok(f.events.indexOf(eventsOf(f, 'idle')[0]) < f.events.indexOf(eventsOf(f, 'persist')[1]))
})

test('未提交对象页单独取消关闭，其余查询不受影响', async () => {
  const f = fixture({ isDirty: (id) => id === 'data', decide: async (page) => (page.id === 'data' ? 'cancel' : 'exit') })
  f.state.activeTab = 'data'
  assert.equal(await runDesktopExit(f.options), false)
  assert.equal(f.state.tabs.length, 4)
  assert.equal(f.state.activeTab, 'data')
  assert.deepEqual(eventsOf(f, 'persist'), [])
})

test('连接释放或最终保存失败保留窗口，已逐项关闭的标签不恢复', async () => {
  const f = fixture()
  f.options.closeConnection = async (id) => {
    f.events.push(['close', id])
    if (id === 'a') throw new Error('release failed')
  }
  await assert.rejects(runDesktopExit(f.options), /A: release failed/)
  assert.deepEqual(eventsOf(f, 'close'), [
    ['close', 'a'],
    ['close', 'b']
  ])
  assert.deepEqual(f.state.tabs, [])
  assert.deepEqual(f.events.at(-1), ['preparing', false])
  const saved = fixture({
    persist: async (value) => {
      if (!value.openedConnections.length) throw new Error('empty index failed')
    }
  })
  await assert.rejects(runDesktopExit(saved.options), /empty index failed/)
  assert.deepEqual(saved.state.tabs, [])
  assert.deepEqual(saved.events.at(-1), ['preparing', false])
})

test('退出保留默认及自定义分组的展开或收起状态，清理连接和数据库后代', async () => {
  const defaultGroup = JSON.stringify(['group', '默认分组'])
  const customGroup = JSON.stringify(['group', '开发: "数据库"'])
  for (const defaultExpanded of [true, false])
    for (const customExpanded of [true, false]) {
      const f = fixture()
      const groups = [...(defaultExpanded ? [defaultGroup] : []), ...(customExpanded ? [customGroup] : [])]
      f.state.explorer.expanded = [
        JSON.stringify(['connection', 'a']),
        ...groups,
        JSON.stringify(['database', 'a', 'db']),
        JSON.stringify(['table', 'a', 'db', 'table']),
        'invalid',
        JSON.stringify(['group', 1])
      ]
      assert.equal(await runDesktopExit(f.options), true)
      assert.deepEqual(f.state.explorer.expanded, groups)
      assert.deepEqual(f.state.explorer.selected, [])
      assert.deepEqual(f.state.openedConnections, [])
    }
})

test('连接关闭去重且并发最多4，最终保存等待全部回执', async () => {
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
        finalSaved = true
      }
    }
  })
  assert.equal(await runDesktopExit(f.options), true)
  assert.equal(maximum, 4)
  assert.equal(finalSaved, true)
  assert.equal(new Set(ids).size, 9)
})
