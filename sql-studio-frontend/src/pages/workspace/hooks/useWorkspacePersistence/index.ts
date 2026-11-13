import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { WorkspaceStore } from '@/services/workspace'
import type { RunState, WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { createLatestWriter } from '@/utils/latestWriter'
import { RequestError } from '@/utils/request'

type Content = { id: string; sql: string; run?: RunState; expectedSQL: string; expectedRun?: RunState }
type Options = {
  busy: boolean
  hydrate: (content: Content) => void
  evict: (ids: string[], expected: WorkspaceSnapshot) => string[]
}

/** The index stays small; only active/in-flight and not-yet-durable content stays resident. */
export function useWorkspacePersistence(snapshot: WorkspaceSnapshot, restore: (snapshot: WorkspaceSnapshot) => void, options: Options) {
  const store = useRef<WorkspaceStore | null>(null)
  const current = useRef({ snapshot, restore, options })
  useLayoutEffect(() => {
    current.current = { snapshot, restore, options }
  })
  const [repository, setRepository] = useState<WorkspaceStore | null>(null)
  const [ready, setReady] = useState(false)
  const [pageLoadFailed, setPageLoadFailed] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [retry, setRetry] = useState(0)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(false)
  const available = useRef(false)
  const version = useRef(0)
  const dirtySince = useRef<number | null>(null)
  const queue = useRef<((value: WorkspaceSnapshot) => Promise<void>) | null>(null)
  const save = useCallback((value: WorkspaceSnapshot) => {
    queue.current ??= createLatestWriter<WorkspaceSnapshot>(async (value) => {
      const repository = store.current
      if (!repository || !available.current) return
      try {
        await repository.commit(value)
      } catch (error) {
        if (error instanceof RequestError && error.status === 409) {
          available.current = false
          setReload(true)
        }
        throw error
      }
      const latest = current.current.snapshot
      const ids = repository.evictable(latest)
      const evicted = current.current.options.evict(ids, latest)
      repository.forget(evicted)
      setEpoch((value) => value + 1)
    })
    return queue.current(value)
  }, [])
  const waitForIdle = reload && options.busy
  useEffect(() => {
    if (waitForIdle) return
    const controller = new AbortController()
    let loading = false
    const load = async () => {
      if (controller.signal.aborted || loading || available.current) return
      loading = true
      try {
        const repository = await WorkspaceStore.open(controller.signal)
        controller.signal.throwIfAborted()
        if (reload && current.current.options.busy) return
        current.current.restore(repository.snapshot())
        store.current = repository
        available.current = true
        setRepository(repository)
        setPageLoadFailed(false)
        setReload(false)
      } catch {
        // Keep the current workspace usable in memory and retry on focus.
      } finally {
        loading = false
        if (!controller.signal.aborted) setReady(true)
      }
    }
    const onFocus = () => {
      if (!current.current.options.busy) void load()
    }
    void load()
    window.addEventListener('focus', onFocus)
    return () => {
      controller.abort()
      window.removeEventListener('focus', onFocus)
    }
  }, [reload, waitForIdle])

  const active = snapshot.activeTab
  const pageReady = !active || !repository || repository.ready(active)
  useEffect(() => {
    const repository = store.current
    if (!ready || !repository || !active || repository.ready(active)) return
    const page = current.current.snapshot.tabs.find((page) => page.id === active)
    if (!page) return
    const controller = new AbortController()
    setPageLoadFailed(false)
    const expectedRun = current.current.snapshot.runs[active]
    void repository
      .hydrate(active, controller.signal)
      .then((content) => {
        if (controller.signal.aborted || store.current !== repository || !current.current.snapshot.tabs.some((page) => page.id === active)) return
        current.current.options.hydrate({ ...content, id: active, expectedSQL: page.sql, expectedRun })
        setEpoch((value) => value + 1)
      })
      .catch(() => {
        if (!controller.signal.aborted && store.current === repository) setPageLoadFailed(true)
      })
    return () => controller.abort()
  }, [active, ready, retry, epoch, repository])

  useEffect(() => {
    if (!ready || !available.current) return
    const token = ++version.current
    const repository = store.current
    if (!pageReady) return
    dirtySince.current ??= Date.now()
    const delay = Math.min(500, Math.max(0, 3000 - (Date.now() - dirtySince.current)))
    const timer = window.setTimeout(() => {
      if (!available.current || store.current !== repository) return
      dirtySince.current = null
      setSaving(true)
      void save(snapshot)
        .catch(() => {})
        .finally(() => {
          if (token === version.current || !available.current) setSaving(false)
        })
    }, delay)
    return () => window.clearTimeout(timer)
  }, [ready, snapshot, pageReady, repository, save])
  async function draftsFor(pages: WorkspaceTab[], signal?: AbortSignal) {
    const repository = store.current
    const output: WorkspaceTab[] = []
    for (let index = 0; index < pages.length; index += 4) {
      signal?.throwIfAborted()
      output.push(
        ...(await Promise.all(
          pages.slice(index, index + 4).map(async (page) => ({ ...page, sql: repository?.page(page.id) && !repository.draftsLoaded.has(page.id) ? await repository.draft(page.id, signal) : page.sql }))
        ))
      )
    }
    signal?.throwIfAborted()
    return output
  }
  return {
    ready,
    pageReady,
    pageLoadFailed,
    retryPage: () => {
      setPageLoadFailed(false)
      setRetry((value) => value + 1)
    },
    draftsFor,
    saving: ready && pageReady && !reload && saving
  }
}
