import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { WorkspaceStore } from '@/services/workspace'
import type { RunState, WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { createLatestWriter } from '@/utils/latestWriter'

type Content = { id: string; sql: string; run?: RunState; expectedSQL: string; expectedRun?: RunState }
type Options = {
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
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [epoch, setEpoch] = useState(0)
  const [retry, setRetry] = useState(0)
  const [saving, setSaving] = useState(false)
  const available = useRef(true)
  const version = useRef(0)
  const dirtySince = useRef<number | null>(null)
  const queue = useRef<((value: WorkspaceSnapshot) => Promise<void>) | null>(null)
  const save = useCallback((value: WorkspaceSnapshot) => {
    queue.current ??= createLatestWriter<WorkspaceSnapshot>(async (value) => {
      const repository = store.current
      if (!repository) throw new Error('工作区尚未读取，拒绝覆盖')
      await repository.commit(value)
      const latest = current.current.snapshot
      const ids = repository.evictable(latest)
      const evicted = current.current.options.evict(ids, latest)
      repository.forget(evicted)
      setEpoch((value) => value + 1)
    })
    return queue.current(value)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void WorkspaceStore.open(controller.signal)
      .then((repository) => {
        controller.signal.throwIfAborted()
        store.current = repository
        setRepository(repository)
        current.current.restore(repository.snapshot())
        setReady(true)
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          available.current = false
          setError(reason instanceof Error ? reason.message : '工作区读取失败，原文件已保留')
          setReady(true)
        }
      })
    return () => controller.abort()
  }, [])

  const active = snapshot.activeTab
  const pageReady = !active || !repository || repository.ready(active)
  useEffect(() => {
    const repository = store.current
    if (!ready || !repository || !active || repository.ready(active)) return
    const page = current.current.snapshot.tabs.find((page) => page.id === active)
    if (!page) return
    const controller = new AbortController()
    setLoadError('')
    const expectedRun = current.current.snapshot.runs[active]
    void repository
      .hydrate(active, controller.signal)
      .then((content) => {
        if (controller.signal.aborted || !current.current.snapshot.tabs.some((page) => page.id === active)) return
        current.current.options.hydrate({ ...content, id: active, expectedSQL: page.sql, expectedRun })
        setEpoch((value) => value + 1)
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : '标签内容加载失败')
      })
    return () => controller.abort()
  }, [active, ready, retry, epoch])

  useEffect(() => {
    if (!ready || !available.current) return
    const token = ++version.current
    queueMicrotask(() => {
      if (token === version.current) setSaving(true)
    })
    if (!pageReady) return
    dirtySince.current ??= Date.now()
    const delay = Math.min(500, Math.max(0, 3000 - (Date.now() - dirtySince.current)))
    const timer = window.setTimeout(() => {
      dirtySince.current = null
      setSaving(true)
      void save(snapshot)
        .then(() => {
          if (token === version.current) {
            setSaving(false)
            setError('')
          }
        })
        .catch((reason) => {
          if (token === version.current) {
            setSaving(false)
            setError(reason instanceof Error ? reason.message : '工作区保存失败')
          }
        })
    }, delay)
    return () => window.clearTimeout(timer)
  }, [ready, snapshot, pageReady, save])
  async function draftsFor(pages: WorkspaceTab[]) {
    const repository = store.current
    const output: WorkspaceTab[] = []
    for (let index = 0; index < pages.length; index += 4)
      output.push(
        ...(await Promise.all(
          pages.slice(index, index + 4).map(async (page) => ({ ...page, sql: repository?.page(page.id) && !repository.draftsLoaded.has(page.id) ? await repository.draft(page.id) : page.sql }))
        ))
      )
    return output
  }
  return {
    ready,
    pageReady,
    loadError,
    retryPage: () => {
      setLoadError('')
      setRetry((value) => value + 1)
    },
    draftsFor,
    saving: ready && saving && !error,
    error
  }
}
