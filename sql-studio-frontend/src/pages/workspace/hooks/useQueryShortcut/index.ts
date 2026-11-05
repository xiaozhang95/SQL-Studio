import type { EditorView } from '@codemirror/view'
import { useEffect, useLayoutEffect, useRef } from 'react'

type Options = { enabled: boolean; editor: { current: EditorView | null }; run: () => void }

/** Capture before CodeMirror's newline shortcut, only inside the visible editor. */
export function useQueryShortcut(options: Options) {
  const current = useRef(options)
  useLayoutEffect(() => {
    current.current = options
  })
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { enabled, editor, run } = current.current
      if (!enabled || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key !== 'Enter' || event.isComposing) return
      if (!(event.target instanceof Node) || !editor.current?.dom.contains(event.target)) return
      if (Array.from(document.querySelectorAll('[aria-modal="true"]')).some((dialog) => dialog.getClientRects().length > 0)) return
      event.preventDefault()
      event.stopPropagation()
      run()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])
}
