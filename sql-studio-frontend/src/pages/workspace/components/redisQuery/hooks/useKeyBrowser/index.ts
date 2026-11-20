import { useCallback, useEffect, useRef, useState } from 'react'

import { useTranslation } from '@/hooks/useTranslation'
import { changeKey, getKey, getKeyTTL, scanKeys } from '@/services/redis'
import type { RedisKey, RedisKeyChange, RedisKeyDetail, RedisKeyPage } from '@/services/redis'
import { RequestError } from '@/utils/request'

type Action = 'create'
type ScanRequest = { pattern: string; cursor: string; continuous?: boolean }
type ScanPage = Omit<RedisKeyPage, 'cursor'> & { pattern: string; cursor: string | null }
const ttlRefreshMs = 1000
const subsequentScanPages = 10

export function useKeyBrowser(id: string, database: number) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const [request, setRequest] = useState<ScanRequest>({ pattern: '', cursor: '0' })
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [page, setPage] = useState<ScanPage>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<RedisKey>()
  const [detail, setDetail] = useState<RedisKeyDetail>()
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [remainingTTL, setRemainingTTL] = useState(-1)
  const expiring = remainingTTL >= 0
  const detailRequest = useRef<AbortController | null>(null)
  const scanRequest = useRef<AbortController | null>(null)
  const selectedRef = useRef<string | undefined>(undefined)
  const mutation = useRef<AbortController | null>(null)
  const [action, setAction] = useState<Action>()
  const [target, setTarget] = useState('')
  const [value, setValue] = useState('')
  const [ttl, setTTL] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)
  const [changeError, setChangeError] = useState('')
  const [lastChange, setLastChange] = useState<RedisKeyChange['action']>()

  const clearMissingKey = useCallback((ref: string) => {
    if (selectedRef.current !== ref) return
    selectedRef.current = undefined
    setSelected(undefined)
    setDetail(undefined)
    setDetailError('')
    setPage((previous) => previous && { ...previous, keys: previous.keys.filter((key) => key.ref !== ref) })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    scanRequest.current = controller
    setLoading(true)
    setError('')
    let cursor = request.cursor
    let cursorExpired = false
    let replaceKeys = cursor === '0'
    let pending: RedisKeyPage[] = []

    const publish = () => {
      if (scanRequest.current !== controller || (!pending.length && !cursorExpired)) return
      const scanned = pending
      const nextCursor = cursorExpired ? null : cursor
      const replace = replaceKeys
      replaceKeys = false
      pending = []
      setPage((previous) => {
        const existing = !replace && previous?.pattern === request.pattern ? previous.keys : []
        const keys = new Map(existing.map((key) => [key.ref, key]))
        for (const page of scanned) {
          for (const key of page.keys) keys.set(key.ref, key)
        }
        return { cursor: nextCursor, keys: [...keys.values()], pattern: request.pattern }
      })
    }

    const scanBatch = async () => {
      const pages = request.continuous ? Infinity : request.cursor === '0' ? 1 : subsequentScanPages
      for (let index = 0; index < pages; index++) {
        controller.signal.throwIfAborted()
        const next = await scanKeys(id, database, request.pattern, cursor, controller.signal)
        controller.signal.throwIfAborted()
        pending.push(next)
        cursor = next.cursor
        if (pending.length === subsequentScanPages) publish()
        if (cursor === '0') break
      }
    }
    void scanBatch()
      .catch((reason) => {
        if (scanRequest.current !== controller || controller.signal.aborted) return
        cursorExpired = reason instanceof RequestError && reason.status === 409
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => {
        if (scanRequest.current !== controller) return
        publish()
        scanRequest.current = null
        setLoading(false)
      })
    return () => {
      if (scanRequest.current === controller) scanRequest.current = null
      controller.abort()
    }
  }, [id, database, request])

  function stopScan() {
    scanRequest.current?.abort()
  }

  useEffect(
    () => () => {
      detailRequest.current?.abort()
      mutation.current?.abort()
    },
    []
  )

  useEffect(() => {
    if (!selected || !detail || !expiring || saving) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refreshTTL(ref: string) {
      try {
        const { ttlMillis } = await getKeyTTL(id, database, ref, controller.signal)
        if (controller.signal.aborted || mutation.current || selectedRef.current !== ref) return
        setRemainingTTL(ttlMillis)
        setDetailError('')
        if (ttlMillis === -2) clearMissingKey(ref)
        if (ttlMillis < 0) return
      } catch (reason) {
        if (controller.signal.aborted || mutation.current || selectedRef.current !== ref) return
        setDetailError(reason instanceof Error ? reason.message : String(reason))
      }
      timer = setTimeout(() => void refreshTTL(ref), ttlRefreshMs)
    }
    timer = setTimeout(() => void refreshTTL(selected.ref), ttlRefreshMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [id, database, selected, detail, expiring, saving, clearMissingKey])

  function scan(pattern: string, cursor = '0', continuous = false) {
    if (mutation.current) return
    // 同一筛选刷新时保留旧树，切换筛选时丢弃旧游标和结果。
    scanRequest.current?.abort()
    scanRequest.current = null
    setLoading(true)
    setRequest({ pattern, cursor, continuous })
    if (cursor !== '0') return
    setPage((previous) => (previous?.pattern === pattern ? previous : undefined))
    detailRequest.current?.abort()
    selectedRef.current = undefined
    setSelected(undefined)
    setDetail(undefined)
    setDetailError('')
    setDetailLoading(false)
  }

  function read(key: RedisKey, refresh = false) {
    if (mutation.current || (!refresh && selectedRef.current === key.ref)) return
    selectedRef.current = key.ref
    detailRequest.current?.abort()
    const controller = new AbortController()
    detailRequest.current = controller
    setSelected(key)
    setDetail(undefined)
    setDetailError('')
    setDetailLoading(true)
    void getKey(id, database, key.ref, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setDetail(value)
          setRemainingTTL(value.ttlMillis)
        }
      })
      .catch((reason: Error) => {
        if (controller.signal.aborted) return
        if (t(reason.message) === t('Redis 键已不存在')) clearMissingKey(key.ref)
        else setDetailError(reason.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false)
      })
  }

  function promptAction(next: Action) {
    setTarget('')
    setValue('')
    setTTL(0)
    setChangeError('')
    setAction(next)
  }

  async function save() {
    if (!action || !target || ttl === null) return
    await commit({ action: 'create', target, value, ttl })
  }

  async function commit(change: RedisKeyChange, item = selected): Promise<boolean> {
    if (mutation.current || (change.action !== 'create' && !item)) return false
    const controller = new AbortController()
    mutation.current = controller
    setSaving(true)
    setLastChange(change.action)
    setChangeError('')
    try {
      const result = await changeKey(id, database, change.action === 'create' ? undefined : item?.ref, change, controller.signal)
      if (controller.signal.aborted) return false
      mutation.current = null
      setAction(undefined)
      if (change.action === 'delete' && item) {
        if (selectedRef.current === item.ref) {
          detailRequest.current?.abort()
          clearMissingKey(item.ref)
          setDetailLoading(false)
        } else setPage((previous) => previous && { ...previous, keys: previous.keys.filter((key) => key.ref !== item.ref) })
      } else if (result.key) {
        setRequest({ pattern: request.pattern, cursor: '0' })
        read(result.key, true)
      } else if (selected && (change.action === 'value' || change.action === 'ttl')) read(selected, true)
      else scan(request.pattern)
      return true
    } catch (reason) {
      if (!controller.signal.aborted) setChangeError(reason instanceof Error ? reason.message : String(reason))
      return false
    } finally {
      if (!controller.signal.aborted) {
        mutation.current = null
        setSaving(false)
      }
    }
  }

  return {
    filter,
    setFilter,
    request,
    page,
    loading,
    error,
    selected,
    detail,
    detailError,
    detailLoading,
    remainingTTL,
    action,
    setAction,
    target,
    setTarget,
    value,
    setValue,
    ttl,
    setTTL,
    saving,
    changeError,
    lastChange,
    setChangeError,
    expandedKeys,
    setExpandedKeys,
    scan,
    stopScan,
    read,
    promptAction,
    save,
    commit
  }
}
