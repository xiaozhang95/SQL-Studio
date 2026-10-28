import type { RunState, StatementRun } from '@/typings/workspace'

/** 兼容旧快照和不记录 SQL 的对象结果，绝不使用当前编辑器草稿。 */
export const statementOutputs = (run: RunState): StatementRun[] => (run.statements?.length ? run.statements : run.result || run.error ? [{ sql: '', result: run.result, error: run.error }] : [])
export const statementDuration = (item: StatementRun) => item.result?.durationMs ?? item.durationMs

/** 导航只展示返回数据列的结果，保留原语句索引用于选择、刷新与恢复。 */
export const resultOutputs = (run: RunState) => statementOutputs(run).flatMap((item, index) => (item.result?.columns.length ? [{ item, index }] : []))

export const defaultOutputView = (run: RunState, index: number, running: boolean): string => {
  if (run.error) return 'messages'
  if (resultOutputs(run).some((entry) => entry.index === index)) return String(index)
  return running || !statementOutputs(run).length ? 'messages' : 'summary'
}
