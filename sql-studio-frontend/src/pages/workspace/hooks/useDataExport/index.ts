import { useEffect, useRef, useState } from 'react'

import { getDatabaseAdapter } from '@/databases'
import type { DumpPlan } from '@/databases/typings'
import { executeQuery, getColumns, getDDL, getSchemas, getTables } from '@/services/database'
import { streamTableData } from '@/services/dataExport'
import type { Connection } from '@/typings/database'
import { createExportWriter } from '@/utils/exportWriter'

type ExportState = {
  connectionId: string
  connection: string
  database: string
  destination: string
  withData: boolean
  status: 'running' | 'completed' | 'cancelled' | 'error'
  startedAt: number
  endedAt?: number
  rows: number
  bytes: number
  total: number
  completed: number
  percent: number
  logs: string[]
  error?: string
}

/** Export owns its request and output file; no workspace page, query lock or persisted rows. */
export function useDataExport() {
  const [state, setState] = useState<ExportState>()
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  function patch(value: Partial<ExportState>) {
    setState((previous) => (previous ? { ...previous, ...value } : previous))
  }
  function log(value: string) {
    setState((previous) => (previous ? { ...previous, logs: [...previous.logs.slice(-149), value] } : previous))
  }
  async function start(connection: Connection, database: string, withData: boolean, table?: string, schema?: string) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    const signal = controller.signal
    setState({
      connectionId: connection.id,
      connection: connection.name,
      database,
      destination: '选择保存文件…',
      withData,
      status: 'running',
      startedAt: Date.now(),
      rows: 0,
      bytes: 0,
      total: 0,
      completed: 0,
      percent: 0,
      logs: ['准备导出']
    })
    let writer: Awaited<ReturnType<typeof createExportWriter>> | undefined
    try {
      // Must run before any network await so the native picker retains user activation.
      writer = await createExportWriter(table ? getDatabaseAdapter(connection.type).tableLabel(table) : database + (schema ? '_' + schema : ''))
      signal.throwIfAborted()
      const output = writer
      patch({ destination: output.destination })
      const write = async (sql: string) => {
        signal.throwIfAborted()
        patch({ bytes: await output.write(sql) })
        signal.throwIfAborted()
      }
      const adapter = getDatabaseAdapter(connection.type)
      const all = await getTables(connection.id, database, signal)
      const tables = all.filter((item) => (!table || item.name === table) && (!schema || adapter.explorer?.tableIdentity(item.name).schema === schema))
      if (table && !tables.length) throw new Error('目标表不存在或无权访问')
      const schemas = adapter.explorer ? (schema ? [schema] : await getSchemas(connection.id, database, signal)) : []
      patch({ total: tables.length })
      const metadata = adapter.dumpFile.metadataSQL ? await executeQuery(connection.id, { database, sql: adapter.dumpFile.metadataSQL(database) }, signal) : undefined
      await write(adapter.dumpFile.header(database, schemas, metadata))
      const plans: { name: string; view: boolean; ddl: string; plan: DumpPlan }[] = []
      // Emit all base structures before any records; views and foreign keys follow data.
      for (const [index, item] of tables.entries()) {
        log(`读取结构：${adapter.tableLabel(item.name)}`)
        const view = item.type.includes('VIEW')
        const [{ ddl }, columns] = await Promise.all([getDDL(connection.id, database, item.name, signal), getColumns(connection.id, database, item.name, signal)])
        const sequenceSQL = !view && adapter.dataDump?.metadataSQL?.(database, item.name)
        const sequence = sequenceSQL ? await executeQuery(connection.id, { database, sql: sequenceSQL, limit: 5000 }, signal) : undefined
        const plan = adapter.dumpFile.prepare(database, item.name, ddl, columns, sequence, withData && !view)
        plans.push({ name: item.name, view, ddl, plan })
        if (!view) await write(plan.before)
        patch({ percent: Math.round((20 * (index + 1)) / tables.length) })
      }
      let rows = 0
      for (const [index, item] of plans.entries()) {
        if (withData && !item.view) {
          log(`传输记录：${adapter.tableLabel(item.name)}`)
          await streamTableData(
            connection.id,
            database,
            item.name,
            async (result) => {
              await write(item.plan.data(result))
              rows += result.rows.length
              patch({ rows })
            },
            signal
          )
        }
        const latest = await getDDL(connection.id, database, item.name, signal)
        const sameDefinition = (adapter.objects ?? adapter.tableDesign)?.sameDefinition
        if (sameDefinition ? !sameDefinition(latest.ddl, item.ddl) : latest.ddl !== item.ddl) throw new Error('导出期间表结构发生变化：' + adapter.tableLabel(item.name))
        if (!item.view) await write(item.plan.after)
        log(`已完成：${adapter.tableLabel(item.name)}${item.view ? '（视图仅导出结构）' : ''}`)
        patch({ completed: index + 1, percent: Math.round(20 + (75 * (index + 1)) / plans.length) })
      }
      for (const item of plans) if (item.plan.constraints) await write(item.plan.constraints)
      for (const item of plans) if (item.view) await write(item.plan.before)
      await write(adapter.dumpFile.footer)
      signal.throwIfAborted()
      await output.close()
      patch({ status: 'completed', endedAt: Date.now(), percent: 100 })
      log(output.completion)
    } catch (error) {
      await writer?.abort()
      const cancelled = signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
      const detail = cancelled ? '导出已取消，未保存完整文件' : error instanceof Error ? error.message : '导出失败'
      patch({ status: cancelled ? 'cancelled' : 'error', endedAt: Date.now(), error: cancelled ? undefined : detail })
      log(detail)
    } finally {
      if (request.current === controller) request.current = null
    }
  }
  return {
    state,
    start,
    busy: state?.status === 'running',
    cancel: () => request.current?.abort(),
    close: () => {
      if (!request.current) setState(undefined)
    }
  }
}
