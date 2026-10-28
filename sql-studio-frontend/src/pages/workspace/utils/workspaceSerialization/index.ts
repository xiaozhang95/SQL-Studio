import type { QueryResult } from '@/typings/database'
import type { RunState, WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'

/** Cache immutable result arrays so typing/scrolling does not walk every cell again. */
export function createWorkspaceSerializer() {
  const runs = new WeakMap<RunState, string>()
  const tabs = new WeakMap<WorkspaceTab, string>()
  const results = new WeakMap<QueryResult, string>()
  const encodeResult = (result: QueryResult) => {
    let json = results.get(result)
    if (json === undefined) {
      json = JSON.stringify(result)
      results.set(result, json)
    }
    return json
  }
  function encodeRun(run: RunState): string {
    const cached = runs.get(run)
    if (cached !== undefined) return cached
    const base = JSON.stringify({ ...run, result: undefined, statements: undefined })
    const fields: string[] = []
    if (run.result && run.result !== run.statements?.at(-1)?.result) fields.push(`"result":${encodeResult(run.result)}`)
    if (run.statements)
      fields.push(
        `"statements":[${run.statements
          .map((item) => {
            const metadata = JSON.stringify({ ...item, result: undefined })
            return item.result ? metadata.slice(0, -1) + `,"result":${encodeResult(item.result)}}` : metadata
          })
          .join(',')}]`
      )
    const encoded = fields.length ? base.slice(0, -1) + (base.length > 2 ? ',' : '') + fields.join(',') + '}' : base
    runs.set(run, encoded)
    return encoded
  }
  return (snapshot: WorkspaceSnapshot) => {
    const base = JSON.stringify({ ...snapshot, runs: undefined, tabs: undefined })
    const pages = snapshot.tabs
      .map((tab) => {
        let encoded = tabs.get(tab)
        if (encoded === undefined) {
          encoded = JSON.stringify(tab)
          tabs.set(tab, encoded)
        }
        return encoded
      })
      .join(',')
    return (
      base.slice(0, -1) +
      `,"tabs":[${pages}],"runs":{${Object.entries(snapshot.runs)
        .map(([id, run]) => `${JSON.stringify(id)}:${encodeRun(run)}`)
        .join(',')}}}`
    )
  }
}

/** Rehydrate the shared last result omitted on disk; old full snapshots remain valid. */
export function restoreWorkspaceResults(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...snapshot,
    runs: Object.fromEntries(
      Object.entries(snapshot.runs).map(([id, run]) => {
        const result = run.result ?? run.statements?.at(-1)?.result
        return [id, result ? { ...run, result } : run]
      })
    )
  }
}
