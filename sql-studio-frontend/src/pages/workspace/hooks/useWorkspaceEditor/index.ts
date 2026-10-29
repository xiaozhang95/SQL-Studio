import type { EditorView, ViewUpdate } from '@codemirror/view'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { EditorLayout } from '@/typings/workspace'

import { createEditorBuffer } from '../../utils/editorBuffer'
import type { EditorChange } from '../../utils/editorBuffer'
import { createEditorHistory } from '../../utils/editorHistory'

type Options = { layouts: Record<string, EditorLayout>; commit: (change: EditorChange) => void }
/** Own the live editor independently of React's persisted draft and layout snapshots. */
export function useWorkspaceEditor(options: Options) {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  const editor = useRef<EditorView | null>(null)
  const owner = useRef('')
  const lastLayout = useRef<EditorLayout | undefined>(undefined)
  const histories = useRef(createEditorHistory())
  const [pending, setPending] = useState(false)
  const buffer = useRef<ReturnType<typeof createEditorBuffer> | null>(null)
  const getBuffer = useCallback(() => (buffer.current ??= createEditorBuffer((change) => latest.current.commit(change), setPending)), [])
  const flush = useCallback(() => buffer.current?.flush(), [])
  const discard = useCallback((ids: ReadonlySet<string>) => {
    buffer.current?.discard(ids)
    histories.current.discard(ids)
    if (ids.has(owner.current)) {
      editor.current = null
      owner.current = ''
    }
  }, [])
  const history = useCallback((id: string) => histories.current.restore(id), [])
  const capture = useCallback(
    (view: EditorView, changed = false) => {
      if (view !== editor.current || !owner.current) return
      const { anchor, head } = view.state.selection.main
      const layout = { anchor, head, top: view.scrollDOM.scrollTop, left: view.scrollDOM.scrollLeft }
      const previous = lastLayout.current
      const moved = !previous || Object.keys(layout).some((key) => layout[key as keyof EditorLayout] !== previous[key as keyof EditorLayout])
      if (!changed && !moved) return
      lastLayout.current = layout
      const doc = view.state.doc
      getBuffer().push({ id: owner.current, ...(changed ? { sql: () => doc.toString() } : {}), layout })
    },
    [getBuffer]
  )
  const detach = useCallback(
    (view?: EditorView) => {
      if (view && view !== editor.current) return
      if (editor.current) {
        capture(editor.current)
        histories.current.save(owner.current, editor.current.state)
      }
      flush()
      editor.current = null
      owner.current = ''
    },
    [flush, capture]
  )
  const attach = useCallback(
    (id: string, view: EditorView) => {
      detach()
      owner.current = id
      editor.current = view
      const saved = latest.current.layouts[id]
      lastLayout.current = saved
      if (saved) {
        const length = view.state.doc.length
        view.dispatch({ selection: { anchor: Math.min(saved.anchor, length), head: Math.min(saved.head, length) } })
        requestAnimationFrame(() => {
          if (editor.current !== view) return
          view.scrollDOM.scrollTop = saved.top
          view.scrollDOM.scrollLeft = saved.left
        })
      }
    },
    [detach]
  )
  const update = useCallback(
    (value: ViewUpdate) => {
      if (value.docChanged || value.selectionSet) capture(value.view, value.docChanged)
    },
    [capture]
  )
  const remember = useCallback(() => {
    if (editor.current) capture(editor.current)
  }, [capture])
  const read = useCallback((id: string, fallback: string) => (owner.current === id && editor.current ? editor.current.state.doc.toString() : fallback), [])
  useEffect(() => {
    const sync = () => {
      remember()
      flush()
    }
    window.addEventListener('pagehide', sync)
    window.addEventListener('blur', sync)
    return () => {
      window.removeEventListener('pagehide', sync)
      window.removeEventListener('blur', sync)
      flush()
    }
  }, [flush, remember])
  return { editor, pending, attach, detach, update, remember, read, flush, discard, history }
}
