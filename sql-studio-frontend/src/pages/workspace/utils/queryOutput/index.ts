import type { RunState, StatementRun } from '@/typings/workspace'

/** 查询使用逐语句结果，对象浏览使用无 SQL 的单结果，绝不读取当前编辑器草稿。 */
export const statementOutputs = (run: RunState): StatementRun[] => (run.statements?.length ? run.statements : run.result || run.error ? [{ sql: '', result: run.result, error: run.error }] : [])
export const statementDuration = (item: StatementRun) => item.result?.durationMs ?? item.durationMs

export const executionCancelled = ({ cancelled, error }: { cancelled?: boolean; error?: string }) => Boolean(cancelled || /^(?:请求已取消|Request cancelled)[。.]?(?:\n|$)/.test(error ?? ''))

/** Older snapshots stored individual failures without their classification. */
export const statementErrorDetail = (item: StatementRun) => ((item.statementError ?? Boolean(item.sql)) && !executionCancelled(item) ? item.error : undefined)

export function pageExecutionError(run?: RunState) {
  if (!run?.error || executionCancelled(run)) return
  const statement = run.statements?.at(-1)
  if (run.kind === 'query' && statement && statementErrorDetail(statement) === run.error) return
  return run.error
}

/** 导航只展示返回数据列的结果，保留原语句索引用于选择、刷新与恢复。 */
export const resultOutputs = (run: RunState) => statementOutputs(run).flatMap((item, index) => (item.result?.columns.length ? [{ item, index }] : []))

export const defaultOutputView = (run: RunState, index: number, running: boolean): string => {
  if (run.error) return 'messages'
  if (resultOutputs(run).some((entry) => entry.index === index)) return String(index)
  if (executionCancelled(run)) return 'messages'
  return running || !statementOutputs(run).length ? 'messages' : 'summary'
}
