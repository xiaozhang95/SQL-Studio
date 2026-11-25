import type { RunState, StatementRun } from '@/typings/workspace'

/** 查询使用逐语句结果，对象浏览使用无 SQL 的单结果，绝不读取当前编辑器草稿。 */
export const statementOutputs = (run: RunState): StatementRun[] =>
  run.statements?.length ? run.statements : run.result || run.error ? [{ sql: '', result: run.result, error: run.error, cancelled: run.cancelled }] : []
export const statementDuration = (item: StatementRun) => item.result?.durationMs ?? item.durationMs

export const executionCancelled = ({ cancelled, error }: { cancelled?: boolean; error?: string }) => Boolean(cancelled || /^(?:请求已取消|Request cancelled)[。.]?(?:\n|$)/.test(error ?? ''))

/** 批次流结束时的错误独立于已收到的逐条回执。 */
export function batchRequestError(run: RunState) {
  if (run.statements?.length && run.error && !executionCancelled(run) && !run.statements.some((item) => item.error === run.error)) return run.error
}

/** Older snapshots stored individual failures without their classification. */
export const statementErrorDetail = (item: StatementRun) => ((item.statementError ?? Boolean(item.sql)) && !executionCancelled(item) ? item.error : undefined)

export function pageExecutionError(run?: RunState) {
  if (!run?.error || executionCancelled(run)) return
  const statement = run.statements?.at(-1)
  if (run.kind === 'query' && statement && statementErrorDetail(statement) === run.error) return
  return run.error
}

/** 导航保留语句位置和该语句内的数据集位置。 */
export const resultOutputKey = (index: number, resultSetIndex = 0) => (resultSetIndex ? `${index}:${resultSetIndex}` : String(index))

export const resultOutputs = (run: RunState) =>
  statementOutputs(run).flatMap((item, index) =>
    item.result?.columns.length
      ? [item.result, ...(item.result.additionalResults ?? [])].map((_, resultSetIndex) => ({ item, index, key: resultOutputKey(index, resultSetIndex) }))
      : []
  )

export const defaultOutputView = (run: RunState, index: number, running: boolean, resultSetIndex = 0): string => {
  if (run.error) return 'messages'
  const statements = statementOutputs(run)
  const result = statements[index]?.result
  if (result?.columns.length) return resultOutputKey(index, result.additionalResults?.[resultSetIndex - 1] ? resultSetIndex : 0)
  if (executionCancelled(run)) return 'messages'
  return running || !statements.length ? 'messages' : 'summary'
}
