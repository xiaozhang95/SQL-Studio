import type { EditorLayout } from '../../../../typings/workspace/index.ts'

type Pending = { id: string; sql?: () => string; layout?: EditorLayout }
export type EditorChange = { id: string; sql?: string; layout?: EditorLayout }
/** Keep only the latest immutable document; flatten it once per bounded batch or explicit flush. */
export function createEditorBuffer(commit: (change: EditorChange) => void, pending: (value: boolean) => void, delay = 250) {
  let next: Pending | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (!next) return
    const current = next
    next = undefined
    const change = { ...current, sql: current.sql?.() }
    commit(change)
    pending(false)
    return change
  }
  return {
    flush,
    push(change: Pending) {
      if (next && next.id !== change.id) flush()
      const first = !next
      next = { ...next, ...change, sql: change.sql ?? next?.sql }
      if (first) pending(true)
      // A fixed deadline also flushes during continuous typing/scrolling.
      timer ??= setTimeout(flush, delay)
    },
    discard(ids: ReadonlySet<string>) {
      if (!next || !ids.has(next.id)) return
      next = undefined
      clearTimeout(timer)
      timer = undefined
      pending(false)
    }
  }
}
