import { useEffect, useRef, useState } from 'react'

import { workspace } from '../../services/workspace'
import type { Layout } from '../../typings/workspace'

const initial: Layout = {
  mode: 'readonly',
  activeId: '',
  draft: '',
  expanded: []
}
export function useWorkspace() {
  const [state, setState] = useState<Layout>(initial)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const current = useRef<Layout>(initial)
  const revision = useRef(0)
  const loaded = useRef(false)
  const blocked = useRef(false)
  const pending = useRef(false)
  const writing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  const leaving = useRef(false)
  async function flush(keepalive = false) {
    if (!loaded.current || blocked.current || writing.current || !pending.current) return
    writing.current = true
    pending.current = false
    const snapshot = current.current
    if (mounted.current) {
      setState(snapshot)
      setSaving(true)
    }
    try {
      const v = await workspace('PUT', { revision: revision.current, state: snapshot }, undefined, keepalive || leaving.current)
      revision.current = v.revision
    } catch (e) {
      blocked.current = true
      if (mounted.current) setError(e instanceof Error ? e.message : '布局保存失败')
    } finally {
      writing.current = false
      if (mounted.current) setSaving(false)
      if (pending.current && !blocked.current) void flush()
    }
  }
  useEffect(() => {
    mounted.current = true
    const c = new AbortController()
    workspace('GET', undefined, c.signal)
      .then((v) => {
        if (c.signal.aborted) return
        current.current = v.state
        revision.current = v.revision
        loaded.current = true
        setState(v.state)
        setReady(true)
      })
      .catch((e: Error) => {
        if (!c.signal.aborted) setError(e.message)
      })
    const onHide = () => {
      leaving.current = true
      void flush(true)
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      mounted.current = false
      c.abort()
      if (timer.current) clearTimeout(timer.current)
      void flush(true)
      window.removeEventListener('pagehide', onHide)
    }
  }, [loadAttempt])
  function update(patch: Partial<Layout>) {
    if (!loaded.current) return
    const next = { ...current.current, ...patch }
    if (JSON.stringify(next) === JSON.stringify(current.current)) return
    current.current = next
    // Form owns live input. Publish draft-only updates with the debounced save.
    if (Object.keys(patch).some((key) => key !== 'draft')) setState(next)
    pending.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 400)
  }
  const retry = () => {
    if (loaded.current) return
    setError('')
    setLoadAttempt((value) => value + 1)
  }
  return { state, ready, error, saving, update, retry }
}
export type WorkspaceController = ReturnType<typeof useWorkspace>
