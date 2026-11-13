import { useEffect, useRef, useState } from 'react'

import { RequestError } from '@/utils/request'

import { workspace } from '../../services/workspace'
import type { Layout, Workspace } from '../../typings/workspace'

const initial: Layout = {
  mode: 'readonly',
  activeId: '',
  draft: '',
  expanded: []
}
export function useWorkspace() {
  const [state, setState] = useState<Layout>(initial)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [latest, setLatest] = useState<Workspace>()
  const [epoch, setEpoch] = useState(0)
  const current = useRef<Layout>(initial)
  const revision = useRef(0)
  const loaded = useRef(false)
  const blocked = useRef(false)
  const pending = useRef(false)
  const writing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  const leaving = useRef(false)
  const reading = useRef<AbortController | null>(null)
  const initialized = useRef(false)
  async function refresh() {
    if (reading.current) return
    const controller = new AbortController()
    reading.current = controller
    try {
      const value = await workspace('GET', undefined, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      if (initialized.current) {
        blocked.current = true
        setLatest(value)
      } else {
        current.current = value.state
        revision.current = value.revision
        loaded.current = true
        setState(value.state)
      }
    } catch {
      // The default layout stays usable in memory until a current configuration can be read.
    } finally {
      if (reading.current === controller) reading.current = null
      if (mounted.current && !controller.signal.aborted) {
        initialized.current = true
        setReady(true)
      }
    }
  }
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
    } catch (error) {
      if (error instanceof RequestError && error.status === 409) {
        blocked.current = true
        pending.current = false
        if (mounted.current) await refresh()
      }
    } finally {
      writing.current = false
      if (mounted.current) setSaving(false)
      if (pending.current && !blocked.current) void flush()
    }
  }
  useEffect(() => {
    mounted.current = true
    const lifetime = new AbortController()
    const onFocus = () => {
      if ((!loaded.current || blocked.current) && !writing.current) void refresh()
    }
    queueMicrotask(() => {
      if (!lifetime.signal.aborted) void refresh()
    })
    const onHide = () => {
      leaving.current = true
      void flush(true)
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('focus', onFocus)
    return () => {
      mounted.current = false
      lifetime.abort()
      reading.current?.abort()
      reading.current = null
      if (timer.current) clearTimeout(timer.current)
      void flush(true)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
  function update(patch: Partial<Layout>) {
    const next = { ...current.current, ...patch }
    if (JSON.stringify(next) === JSON.stringify(current.current)) return
    current.current = next
    // Form owns live input. Publish draft-only updates with the debounced save.
    if (Object.keys(patch).some((key) => key !== 'draft')) setState(next)
    if (!loaded.current || blocked.current) return
    pending.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 400)
  }
  const applyLatest = () => {
    if (!latest) return
    current.current = latest.state
    revision.current = latest.revision
    loaded.current = true
    blocked.current = false
    setState(latest.state)
    setLatest(undefined)
    setEpoch((value) => value + 1)
  }
  return { state, ready, saving, update, applyLatest, epoch }
}
export type WorkspaceController = ReturnType<typeof useWorkspace>
