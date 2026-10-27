import type { RunState, StatementRun } from '@/typings/workspace'

/** 兼容旧快照和不记录 SQL 的对象结果，绝不使用当前编辑器草稿。 */
export const statementOutputs = (run: RunState): StatementRun[] => (run.statements?.length ? run.statements : run.result || run.error ? [{ sql: '', result: run.result, error: run.error }] : [])
export const statementDuration = (item: StatementRun) => item.result?.durationMs ?? item.durationMs
