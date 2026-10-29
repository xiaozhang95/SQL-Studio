import { acceptCompletion, autocompletion, closeCompletion, completionStatus, currentCompletions, selectedCompletionIndex, setSelectedCompletion } from '@codemirror/autocomplete'
import type { Completion } from '@codemirror/autocomplete'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { sqlCompletionLayout } from '../../constant/layout'

type Popup = { view: EditorView; items: readonly Completion[]; selected: number | null; left: number; top: number; width: number }

/** 补全来源、排序、快捷键和插入继续由 CodeMirror 管理，仅将候选项交给 Ant Design 展示。 */
export function useSQLCompletionPopup() {
  const [popup, setPopup] = useState<Popup>()
  const mounted = useRef(true)
  const measureKey = useRef({})
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const extensions = useMemo(() => [autocompletion({ tooltipClass: () => 'sql-native-completion' })], [])
  const synchronize = useCallback((view: EditorView) => {
    view.requestMeasure({
      key: measureKey.current,
      read: () => {
        if (!view.hasFocus || completionStatus(view.state) !== 'active') return undefined
        const items = currentCompletions(view.state)
        const rect = view.coordsAtPos(view.state.selection.main.head)
        if (!items.length || !rect) return undefined
        const width = Math.min(sqlCompletionLayout.width, window.innerWidth - 16)
        return { view, items, selected: selectedCompletionIndex(view.state), width, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: rect.bottom + 4 }
      },
      write: (next) => {
        if (!mounted.current) return
        setPopup((previous) => {
          if (!next) return undefined
          return previous?.view === next.view &&
            previous.selected === next.selected &&
            previous.left === next.left &&
            previous.top === next.top &&
            previous.width === next.width &&
            previous.items.length === next.items.length &&
            previous.items.every((item, index) => item === next.items[index])
            ? previous
            : next
        })
      }
    })
  }, [])
  const update = useCallback((change: ViewUpdate) => synchronize(change.view), [synchronize])
  useEffect(() => {
    const view = popup?.view
    if (!view) return
    const reposition = () => {
      if (view.dom.isConnected) synchronize(view)
    }
    document.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [popup?.view, synchronize])
  const choose = (index: number) => {
    if (!popup || !popup.view.dom.isConnected) return
    popup.view.dispatch({ effects: setSelectedCompletion(index) })
    acceptCompletion(popup.view)
    popup.view.focus()
  }
  const close = () => {
    if (popup?.view.dom.isConnected) closeCompletion(popup.view)
    setPopup(undefined)
  }
  return { popup, extensions, update, choose, close }
}
