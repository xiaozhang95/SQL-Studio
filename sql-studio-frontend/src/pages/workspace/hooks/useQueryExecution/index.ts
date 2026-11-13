import type { MessageInstance } from 'antd/es/message/interface'
import { useLayoutEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { getDatabaseAdapter } from '@/databases'
import { executeQuery } from '@/services/database'
import type { Connection } from '@/typings/database'
import type { HistoryItem, QueryScope, ResultView, RunState, StatementRun, WorkspacePageKind, WorkspaceTab } from '@/typings/workspace'

import type { useDatabaseObjects } from '../useDatabaseObjects'

type Options = {
  connections: Connection[]
  objects: Pick<ReturnType<typeof useDatabaseObjects>, 'snapshots'>
  running: boolean
  request: { current: AbortController | null }
  message: Pick<MessageInstance, 'info' | 'success'> & { error: (reason: string) => unknown }
  startRun: (id: string, run: RunState) => AbortController
  finishRun: (controller: AbortController) => void
  publishResult: (id: string, run: RunState) => void
  setTabs: Dispatch<SetStateAction<WorkspaceTab[]>>
  setResultViews: Dispatch<SetStateAction<Record<string, ResultView>>>
  appendHistory: (item: HistoryItem) => void
}

export function createQueryExecutor({ connections, objects, running, request, message, startRun, finishRun, publishResult, setTabs, setResultViews, appendHistory }: Options) {
  async function executeSQL(statement: string, scope: QueryScope, tabId: string, kind: WorkspacePageKind = 'query') {
    const target = connections.find((item) => item.id === scope.connectionId)
    if (!target || objects.snapshots[target.id]?.status !== 'connected' || running || request.current) return
    let statements: string[]
    try {
      statements = getDatabaseAdapter(target.type).splitStatements(statement)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'SQL 解析失败')
      return
    }
    if (!statements.length) {
      message.info('请先输入 SQL 语句')
      return
    }
    const source = `${target.name} / ${scope.database || '未选择数据库'}${scope.schema ? ' / ' + scope.schema : ''}`
    const title = kind === 'data' ? `${getDatabaseAdapter(target.type).tableLabel(scope.table)} · 数据` : 'SQL 结果'
    const startedAt = new Date().toISOString()
    const batchStart = performance.now()
    const controller = startRun(tabId, { scope: { ...scope }, source, kind, title, statementCount: statements.length, startedAt, durationMs: 0 })
    const completed: StatementRun[] = []
    let executionDatabase = scope.database
    try {
      // 驱动继续保持单语句；整批固定连接、取消信号和运行锁，默认库跟随成功的 USE，逐条保留结果与历史。
      for (const [index, sql] of statements.entries()) {
        const start = performance.now()
        const item: HistoryItem = {
          id: crypto.randomUUID(),
          sql,
          database: executionDatabase,
          connectionId: target.id,
          connectionName: target.name,
          databaseType: target.type,
          schema: scope.schema,
          time: new Date().toISOString(),
          durationMs: 0,
          ok: false
        }
        const entry: StatementRun = { sql, database: executionDatabase, schema: scope.schema }
        try {
          if (controller.signal.aborted) throw new Error('请求已取消')
          entry.result = await executeQuery(
            target.id,
            { database: executionDatabase, ...(scope.schema ? { schema: scope.schema } : {}), sql, ...(kind === 'query' ? { allowWrite: true } : {}) },
            controller.signal
          )
          if (controller.signal.aborted) throw new Error('请求已取消')
          const selectedDatabase = getDatabaseAdapter(target.type).useDatabase(sql)
          if (selectedDatabase !== undefined) {
            executionDatabase = selectedDatabase
            setTabs((previous) =>
              previous.map((page) => (page.id === tabId && page.kind === 'query' && page.connectionId === target.id ? { ...page, database: selectedDatabase, schema: '', table: '' } : page))
            )
          }
          item.ok = true
          item.durationMs = entry.result.durationMs
          if (!entry.result.isQuery) message.success(`执行成功，影响 ${entry.result.affectedRows} 行`)
        } catch (error) {
          entry.result = undefined
          const reason = controller.signal.aborted ? '请求已取消。' : error instanceof Error ? error.message : '查询失败'
          const remaining = statements.length - index - 1
          entry.error = `${reason}${remaining ? `\n后续 ${remaining} 条语句未执行。` : ''}`
          item.error = reason
          item.durationMs = Math.round(performance.now() - start)
        }
        entry.durationMs = item.durationMs
        completed.push(entry)
        if (kind === 'query') appendHistory(item)
        publishResult(tabId, {
          scope: { ...scope },
          kind,
          result: entry.result,
          error: entry.error,
          source,
          title,
          statements: [...completed],
          statementCount: statements.length,
          startedAt,
          endedAt: entry.error || index === statements.length - 1 ? new Date().toISOString() : undefined,
          durationMs: Math.round(performance.now() - batchStart)
        })
        setResultViews((previous) => ({ ...previous, [tabId]: { search: '', page: 1, resultIndex: index } }))
        if (entry.error) break
      }
    } finally {
      finishRun(controller)
    }
  }
  return executeSQL
}

/** Capture the initiating page and engine once per batch, using current options. */
export function useQueryExecution(options: Options) {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  return (sql: string, scope: QueryScope, id: string, kind: WorkspacePageKind = 'query') => createQueryExecutor(latest.current)(sql, scope, id, kind)
}
