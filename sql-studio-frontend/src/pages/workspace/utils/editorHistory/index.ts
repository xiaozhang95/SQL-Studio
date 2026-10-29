import { historyField } from '@codemirror/commands'
import type { EditorState, Extension } from '@codemirror/state'

/** Keep undo/redo changes per open page, without retaining its document, view or configuration. */
export function createEditorHistory() {
  const pages = new Map<string, unknown>()
  return {
    save(id: string, state: EditorState) {
      const value = state.field(historyField, false)
      if (value !== undefined) pages.set(id, value)
    },
    restore(id: string): Extension[] {
      return pages.has(id) ? [historyField.init(() => pages.get(id))] : []
    },
    discard(ids: ReadonlySet<string>) {
      for (const id of ids) pages.delete(id)
    }
  }
}
