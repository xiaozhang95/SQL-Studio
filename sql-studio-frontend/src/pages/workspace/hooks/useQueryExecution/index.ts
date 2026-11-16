import type { MessageInstance } from 'antd/es/message/interface'
import { useLayoutEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { getDatabaseAdapter } from '@/databases'
import { splitRedisLines } from '@/databases/redis/editor'
import { DatabaseEngine } from '@/databases/typings'
import { executeQuery } from '@/services/database'
import { executeQueryBatch } from '@/services/queryBatch'
import { runCommand } from '@/services/redis'
import type { Connection } from '@/typings/database'
import type { HistoryItem, QueryScope, ResultView, RunState, StatementRun, WorkspacePageKind, WorkspaceTab } from '@/typings/workspace'

import type { useDatabaseObjects } from '../useDatabaseObjects'

type Options = {
  connections: Connection[]
  objects: Pick<ReturnType<typeof useDatabaseObjects>, 'snapshots'>
  running: boolean
  request: { current: AbortController | null }
  message: Pick<MessageInstance, 'info'> & { error: (reason: string) => unknown }
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
    const redis = target.type === DatabaseEngine.Redis
    if (redis && kind !== 'query') return
    const adapter = redis ? undefined : getDatabaseAdapter(target.type)
    let statements: string[]
    try {
      statements = adapter ? adapter.splitStatements(statement) : splitRedisLines(statement)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'SQL 解析失败')
      return
    }
    if (!statements.length) {
      message.info(redis ? '请输入一条有效的 Redis 命令' : statement.trim() ? '内容仅包含注释或空白，无需执行' : '请先输入 SQL 语句')
      return
    }
    const source = `${target.name} / ${scope.database || '未选择数据库'}${scope.schema ? ' / ' + scope.schema : ''}`
    const title = kind === 'data' ? `${adapter?.tableLabel(scope.table)} · 数据` : redis ? 'Redis 执行结果' : 'SQL 结果'
    const startedAt = new Date().toISOString()
    const batchStart = performance.now()
    const controller = startRun(tabId, { scope: { ...scope }, source, kind, title, statementCount: statements.length, startedAt, durationMs: 0 })
    const completed: StatementRun[] = []
    let executionDatabase = scope.database
    const record = (index: number, outcome: Pick<StatementRun, 'result' | 'error' | 'durationMs'>, selectedDatabase?: string) => {
      const sql = statements[index]
      const entry: StatementRun = { ...outcome, sql, database: executionDatabase, schema: scope.schema }
      if (selectedDatabase !== undefined) {
        executionDatabase = selectedDatabase
        setTabs((previous) =>
          previous.map((page) => (page.id === tabId && page.kind === 'query' && page.connectionId === target.id ? { ...page, database: selectedDatabase, schema: '', table: '' } : page))
        )
      }
      if (kind === 'query') {
        const item: HistoryItem = {
          id: crypto.randomUUID(),
          sql,
          database: entry.database ?? '',
          connectionId: target.id,
          connectionName: target.name,
          databaseType: target.type,
          schema: scope.schema,
          time: new Date().toISOString(),
          durationMs: entry.durationMs ?? 0,
          ok: !entry.error,
          error: entry.error
        }
        appendHistory(item)
      }
      if (entry.error) {
        const remaining = statements.length - index - 1
        if (remaining) entry.error += `\n后续 ${remaining} 条语句未执行。`
      }
      completed.push(entry)
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
    }
    try {
      if (adapter?.sessionBatch && kind === 'query' && statements.length > 1) {
        let lastStep = batchStart
        await executeQueryBatch(target.id, executionDatabase, statements, controller.signal, (step) => {
          const now = performance.now()
          record(step.index, { result: step.result, error: step.error, durationMs: step.result?.durationMs ?? Math.round(now - lastStep) }, step.database)
          lastStep = now
        })
      } else {
        for (const [index, sql] of statements.entries()) {
          const start = performance.now()
          try {
            controller.signal.throwIfAborted()
            if (redis) {
              const reply = await runCommand(target.id, Number(executionDatabase), sql, controller.signal)
              controller.signal.throwIfAborted()
              const durationMs = reply.result?.durationMs ?? Math.round(performance.now() - start)
              const result = reply.result ?? {
                columns: [{ name: 'value', type: '' }],
                rows: [[reply.output]],
                rowCount: 1,
                affectedRows: 0,
                lastInsertId: '',
                durationMs,
                truncated: reply.truncated,
                isQuery: true
              }
              record(index, { result, durationMs }, String(reply.database) !== executionDatabase ? String(reply.database) : undefined)
              continue
            }
            const result = await executeQuery(
              target.id,
              { database: executionDatabase, ...(scope.schema ? { schema: scope.schema } : {}), sql, ...(kind === 'query' ? { allowWrite: true } : {}) },
              controller.signal
            )
            controller.signal.throwIfAborted()
            record(index, { result, durationMs: result.durationMs }, adapter?.useDatabase(sql))
          } catch (error) {
            const reason = controller.signal.aborted ? '请求已取消。' : error instanceof Error ? error.message : '查询失败'
            record(index, { error: reason, durationMs: Math.round(performance.now() - start) })
            break
          }
        }
      }
    } catch (error) {
      const reason = controller.signal.aborted ? '请求已取消。' : error instanceof Error ? error.message : '查询失败'
      if (!completed.at(-1)?.error) {
        const durationMs = Math.round(performance.now() - batchStart)
        // A dropped stream cannot confirm whether its last in-flight write finished.
        publishResult(tabId, {
          scope: { ...scope },
          kind,
          source,
          title,
          statements: [...completed],
          statementCount: statements.length,
          result: completed.at(-1)?.result,
          error: reason,
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs
        })
        setResultViews((previous) => ({ ...previous, [tabId]: { search: '', page: 1, resultIndex: completed.length } }))
      } else if (!controller.signal.aborted) {
        message.error(reason)
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
