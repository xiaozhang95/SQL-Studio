import type { RunState, WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'

import { request, RequestError } from '../../utils/request/index.ts'

export type StoredPage = Omit<WorkspaceTab, 'sql'> & { draftRef: string; resultRef: string; interrupted?: boolean }
export type WorkspaceIndex = Omit<WorkspaceSnapshot, 'version' | 'tabs' | 'runs'> & { version: 2; tabs: StoredPage[] }
type Document = { revision: number; index: WorkspaceIndex }
type Hydrated = { sql: string; run?: RunState }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const reference = (value: unknown) => typeof value === 'string' && (!value || /^[a-f0-9]{64}$/.test(value))
function document(value: unknown): Document {
  if (!object(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || !object(value.index)) throw new Error('工作区索引响应无效')
  const index = value.index
  if (
    index.version !== 2 ||
    !Array.isArray(index.tabs) ||
    !index.tabs.every(
      (page: unknown) =>
        object(page) &&
        ['id', 'title', 'kind', 'connectionId', 'database', 'table'].every((key) => typeof page[key] === 'string') &&
        ['query', 'data', 'structure', 'ddl', 'table-create', 'table-design'].includes(String(page.kind)) &&
        reference(page.draftRef) &&
        Boolean(page.draftRef) &&
        reference(page.resultRef) &&
        (page.schema === undefined || typeof page.schema === 'string') &&
        (page.interrupted === undefined || typeof page.interrupted === 'boolean') &&
        (page.resultStatus === undefined || ['success', 'error', ''].includes(String(page.resultStatus))) &&
        (page.resultSource === undefined || typeof page.resultSource === 'string')
    ) ||
    typeof index.activeTab !== 'string' ||
    typeof index.runningTabId !== 'string' ||
    !object(index.resultViews) ||
    !object(index.editorLayouts) ||
    !object(index.explorer) ||
    !Array.isArray(index.explorer.expanded) ||
    !Array.isArray(index.explorer.selected) ||
    typeof index.explorer.search !== 'string' ||
    !Array.isArray(index.openedConnections) ||
    !index.openedConnections.every((id: unknown) => typeof id === 'string')
  )
    throw new Error('工作区索引内容无效')
  const ids = index.tabs.map((page) => page.id)
  if (new Set(ids).size !== ids.length || (index.activeTab && !ids.includes(index.activeTab))) throw new Error('工作区标签标识无效')
  return value as Document
}
function runState(value: unknown): RunState {
  const result = (data: unknown) =>
    object(data) &&
    Array.isArray(data.columns) &&
    data.columns.every((col: unknown) => object(col) && typeof col.name === 'string' && typeof col.type === 'string') &&
    Array.isArray(data.rows) &&
    data.rows.every((row: unknown) => Array.isArray(row) && Array.isArray(data.columns) && row.length === data.columns.length) &&
    typeof data.isQuery === 'boolean'
  if (
    !object(value) ||
    typeof value.source !== 'string' ||
    (value.error !== undefined && typeof value.error !== 'string') ||
    (value.result !== undefined && !result(value.result)) ||
    (value.statements !== undefined &&
      (!Array.isArray(value.statements) ||
        !value.statements.every(
          (item: unknown) => object(item) && typeof item.sql === 'string' && (item.error === undefined || typeof item.error === 'string') && (item.result === undefined || result(item.result))
        )))
  )
    throw new Error('保存的查询结果损坏，已保留原内容')
  const run = value as RunState
  return run.result ? run : { ...run, result: run.statements?.at(-1)?.result }
}

async function part(reference: string, signal?: AbortSignal): Promise<unknown> {
  try {
    return await request<unknown>('/workspace/parts/' + reference, { signal })
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) throw new Error('保存内容已更新或被清理，请刷新工作区后重试。')
    throw error
  }
}

/** No content cache: only the index and baselines for currently resident pages are retained. */
export class WorkspaceStore {
  readonly draftsLoaded = new Set<string>()
  readonly resultsLoaded = new Set<string>()
  readonly savedDrafts = new Map<string, string>()
  readonly savedResults = new Map<string, RunState | undefined>()
  private needsCommit = false
  doc: Document
  constructor(doc: Document) {
    this.doc = doc
  }
  static async open(signal?: AbortSignal) {
    const doc = document(await request<unknown>('/workspace', { signal }))
    const interrupted = doc.index.runningTabId
    if (interrupted) doc.index = { ...doc.index, runningTabId: '', tabs: doc.index.tabs.map((page) => (page.id === interrupted ? { ...page, interrupted: true } : page)) }
    const store = new WorkspaceStore(doc)
    store.needsCommit = Boolean(interrupted)
    return store
  }
  page(id: string) {
    return this.doc.index.tabs.find((page) => page.id === id)
  }
  ready(id: string) {
    const page = this.page(id)
    return !page || (this.draftsLoaded.has(id) && (!page.resultRef || this.resultsLoaded.has(id)))
  }
  async draft(id: string, signal?: AbortSignal) {
    const page = this.page(id)
    if (!page) return ''
    const value = await part(page.draftRef, signal)
    if (!object(value) || typeof value.sql !== 'string') throw new Error('保存的 SQL 草稿损坏，已保留原内容')
    return value.sql
  }
  async hydrate(id: string, signal?: AbortSignal): Promise<Hydrated> {
    const page = this.page(id)
    if (!page) return { sql: '' }
    const [sql, stored] = await Promise.all([this.draft(id, signal), page.resultRef ? part(page.resultRef, signal) : undefined])
    signal?.throwIfAborted()
    let run = stored === undefined ? undefined : runState(stored)
    if (run && page.interrupted) run = { ...run, interrupted: true, error: run.result ? run.error : '页面刷新中断了上次执行，请手动重新运行。' }
    this.draftsLoaded.add(id)
    this.resultsLoaded.add(id)
    this.savedDrafts.set(id, sql)
    this.savedResults.set(id, run)
    return { sql, run }
  }
  snapshot(content?: { id: string } & Hydrated): WorkspaceSnapshot {
    const { tabs, ...layout } = this.doc.index
    return {
      ...layout,
      version: 1,
      tabs: tabs.map((page) => {
        const { draftRef: _draft, resultRef: _result, interrupted: _interrupted, ...tab } = page
        return { ...tab, sql: content?.id === page.id ? content.sql : '' }
      }),
      runs: content?.run ? { [content.id]: content.run } : {}
    }
  }
  async commit(snapshot: WorkspaceSnapshot) {
    const drafts: Record<string, string> = {},
      results: Record<string, RunState | null> = {}
    const tabs = snapshot.tabs.map((tab) => {
      const prior = this.page(tab.id)
      const { sql, ...metadata } = tab
      if (!prior || (this.draftsLoaded.has(tab.id) && this.savedDrafts.get(tab.id) !== sql)) drafts[tab.id] = sql
      const run = snapshot.runs[tab.id]
      if (tab.id !== snapshot.runningTabId && (!prior?.resultRef || this.resultsLoaded.has(tab.id) || run !== undefined) && this.savedResults.get(tab.id) !== run) results[tab.id] = run ?? null
      const output = tab.id === snapshot.runningTabId ? undefined : (run?.statements?.[snapshot.resultViews[tab.id]?.resultIndex || 0] ?? run)
      const resultStatus = output?.error ? 'error' : output?.result ? 'success' : metadata.resultStatus
      return {
        ...metadata,
        resultStatus,
        resultSource: run?.source ?? metadata.resultSource,
        draftRef: prior?.draftRef ?? '',
        resultRef: prior?.resultRef ?? '',
        interrupted: run ? run.interrupted : prior?.interrupted
      }
    })
    const { runs: _runs, tabs: _tabs, ...layout } = snapshot
    const index: WorkspaceIndex = { ...layout, version: 2, tabs }
    // Omit only the duplicate last result; selected/earlier result sets remain intact.
    const compact = Object.fromEntries(Object.entries(results).map(([id, run]) => [id, run ? { ...run, result: run.result === run.statements?.at(-1)?.result ? undefined : run.result } : null]))
    if (!this.needsCommit && !Object.keys(drafts).length && !Object.keys(results).length && JSON.stringify(index) === JSON.stringify(this.doc.index)) return
    try {
      this.doc = document(await request<unknown>('/workspace', { method: 'PUT', body: JSON.stringify({ revision: this.doc.revision, index, drafts, results: compact }) }))
    } catch (error) {
      if (error instanceof RequestError && error.status === 409) throw new RequestError('工作区保存冲突：其他窗口已更新本机配置。当前草稿尚未保存，请通过“恢复保存”导出副本并重新载入。', 409)
      throw error
    }
    this.needsCommit = false
    for (const [id, sql] of Object.entries(drafts)) {
      this.draftsLoaded.add(id)
      this.savedDrafts.set(id, sql)
    }
    for (const id of Object.keys(results)) {
      this.resultsLoaded.add(id)
      this.savedResults.set(id, snapshot.runs[id])
    }
  }
  evictable(snapshot: WorkspaceSnapshot) {
    return snapshot.tabs
      .filter(
        (tab) =>
          tab.id !== snapshot.activeTab &&
          tab.id !== snapshot.runningTabId &&
          this.page(tab.id) &&
          (!this.draftsLoaded.has(tab.id) || this.savedDrafts.get(tab.id) === tab.sql) &&
          (!snapshot.runs[tab.id] || this.savedResults.get(tab.id) === snapshot.runs[tab.id])
      )
      .filter((tab) => this.draftsLoaded.has(tab.id) || this.resultsLoaded.has(tab.id))
      .map((tab) => tab.id)
  }
  forget(ids: string[]) {
    for (const id of ids) {
      this.draftsLoaded.delete(id)
      this.resultsLoaded.delete(id)
      this.savedDrafts.delete(id)
      this.savedResults.delete(id)
    }
    const retained = new Set(this.doc.index.tabs.map((page) => page.id))
    for (const id of new Set([...this.savedDrafts.keys(), ...this.savedResults.keys()]))
      if (!retained.has(id)) {
        this.draftsLoaded.delete(id)
        this.resultsLoaded.delete(id)
        this.savedDrafts.delete(id)
        this.savedResults.delete(id)
      }
  }
}
