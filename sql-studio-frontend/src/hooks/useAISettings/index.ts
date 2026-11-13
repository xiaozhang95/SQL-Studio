import { useEffect, useRef, useState } from 'react'

import { getAIAdapter, isAIProvider } from '@/ai'
import { aiModelsSection, maxAIConfigurations } from '@/ai/typings'
import type { AIConfigDocument, AIConfiguration, AISettingsEntry } from '@/ai/typings'
import { request } from '@/utils/request'

const snapshot = (entries: readonly AIConfiguration[], activeId: string) =>
  JSON.stringify({ entries: entries.map(({ id, provider, model, modelName }) => ({ id, provider, model, modelName })), activeId })

/** 管理已完成选择的模型列表；Key 只在本次设置草稿与后端配置中存在。 */
export function useAISettings() {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<AISettingsEntry[]>([])
  const [activeId, setActiveId] = useState('')
  const [baseline, setBaseline] = useState<{ signature: string; entries: ReadonlyMap<string, Pick<AIConfiguration, 'provider' | 'model'>> }>({
    signature: '',
    entries: new Map()
  })
  const [connectionTests, setConnectionTests] = useState<Record<string, { loading: boolean; success?: boolean; message?: string }>>({})
  const testRequests = useRef(new Map<string, AbortController>())
  const revision = useRef(0)
  const generation = useRef(0)
  const pending = useRef(false)
  const readRequest = useRef<AbortController | null>(null)

  const cancelAll = () => {
    readRequest.current?.abort()
    for (const controller of testRequests.current.values()) controller.abort()
    testRequests.current.clear()
  }
  const cancelTest = (id: string) => {
    testRequests.current.get(id)?.abort()
    testRequests.current.delete(id)
    setConnectionTests((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }
  useEffect(
    () => () => {
      generation.current++
      cancelAll()
    },
    []
  )

  const receive = (doc: AIConfigDocument, previous: readonly AISettingsEntry[] = []) => {
    if (!Number.isSafeInteger(doc.revision) || doc.revision < 0) throw new Error('AI 配置修订号无效')
    const records = doc.data === null ? [] : doc.data.configurations
    if (!Array.isArray(records) || records.length > maxAIConfigurations) throw new Error('AI 配置列表无效')
    const ids = new Set<string>()
    const values = records.map((record): AISettingsEntry => {
      if (
        !record ||
        typeof record.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(record.id) ||
        ids.has(record.id) ||
        !isAIProvider(record.provider) ||
        typeof record.model !== 'string' ||
        !record.model ||
        typeof record.modelName !== 'string' ||
        !record.modelName.trim() ||
        record.configured !== true
      )
        throw new Error('AI 配置记录无效')
      ids.add(record.id)
      const cached = previous.find((entry) => entry.id === record.id)
      return {
        id: record.id,
        provider: record.provider,
        model: record.model,
        modelName: record.modelName,
        configured: true,
        apiKey: '',
        models: cached?.models ?? [],
        modelsLoading: false,
        modelsError: ''
      }
    })
    const selected = doc.data === null ? '' : doc.data.activeId
    if (typeof selected !== 'string') throw new Error('模型配置格式无效')
    if (selected && !ids.has(selected)) throw new Error('当前模型配置无效')
    revision.current = doc.revision
    setBaseline({
      signature: snapshot(values, selected),
      entries: new Map(values.map(({ id, provider, model }) => [id, { provider, model }]))
    })
    setEntries(values)
    setConnectionTests({})
    setActiveId(selected || values[0]?.id || '')
    setReady(true)
    return values
  }
  const show = async () => {
    if (pending.current) return
    cancelAll()
    const session = ++generation.current
    const controller = new AbortController()
    readRequest.current = controller
    setReady(false)
    setLoading(true)
    setError('')
    setEntries([])
    setActiveId('')
    setConnectionTests({})
    try {
      const doc = await request<AIConfigDocument>('/state/' + aiModelsSection, { signal: controller.signal })
      if (session !== generation.current || controller.signal.aborted) return
      receive(doc)
    } catch (cause) {
      if (session === generation.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : '读取失败')
    } finally {
      if (session === generation.current && !controller.signal.aborted) setLoading(false)
    }
  }
  const close = () => {
    if (pending.current) return
    generation.current++
    cancelAll()
    setEntries([])
    setActiveId('')
    setReady(false)
  }
  const upsertEntry = (entry: AISettingsEntry) => {
    if (!ready || pending.current || !entry.model || !entry.modelName || (!entry.configured && !entry.apiKey.trim())) return false
    if (entries.some((row) => row.id !== entry.id && row.provider === entry.provider && row.model === entry.model)) return false
    const existing = entries.some((row) => row.id === entry.id)
    if (!existing && entries.length >= maxAIConfigurations) return false
    cancelTest(entry.id)
    setEntries((values) => (existing ? values.map((row) => (row.id === entry.id ? entry : row)) : [...values, entry]))
    if (!activeId) setActiveId(entry.id)
    setError('')
    return true
  }
  const removeEntry = (id: string) => {
    if (!ready || pending.current) return
    cancelTest(id)
    const remaining = entries.filter((entry) => entry.id !== id)
    setEntries(remaining)
    if (activeId === id) setActiveId(remaining[0]?.id ?? '')
    setError('')
  }
  const selectActive = (id: string) => {
    if (!ready || pending.current || !entries.some((entry) => entry.id === id)) return
    setActiveId(id)
    setError('')
  }
  const testConnection = async (id: string) => {
    const entry = entries.find((value) => value.id === id)
    if (!entry || pending.current || testRequests.current.has(id)) return
    const controller = new AbortController()
    testRequests.current.set(id, controller)
    const session = generation.current
    setConnectionTests((current) => ({ ...current, [id]: { loading: true } }))
    try {
      const models = await getAIAdapter(entry.provider).listModels(entry.apiKey.trim(), controller.signal, entry.configured ? id : undefined)
      if (controller.signal.aborted || session !== generation.current) return
      if (!models.some((model) => model.id === entry.model)) throw new Error('连接成功，但此 Key 无法使用该模型')
      setConnectionTests((current) => ({ ...current, [id]: { loading: false, success: true, message: '连接成功' } }))
    } catch (cause) {
      if (!controller.signal.aborted && session === generation.current)
        setConnectionTests((current) => ({ ...current, [id]: { loading: false, success: false, message: cause instanceof Error ? cause.message : '连接失败' } }))
    } finally {
      if (testRequests.current.get(id) === controller) testRequests.current.delete(id)
    }
  }
  const changed = ready && (snapshot(entries, activeId) !== baseline.signature || entries.some((entry) => Boolean(entry.apiKey.trim())))
  const pairs = new Set(entries.map((entry) => JSON.stringify([entry.provider, entry.model])))
  const canSave =
    ready &&
    !loading &&
    !saving &&
    pairs.size === entries.length &&
    (entries.length === 0 ? activeId === '' : entries.some((entry) => entry.id === activeId)) &&
    entries.every((entry) => {
      const saved = baseline.entries.get(entry.id)
      const edited = !saved || Boolean(entry.apiKey.trim()) || saved.model !== entry.model || saved.provider !== entry.provider
      return Boolean(entry.model && entry.modelName) && (!edited || (!entry.modelsLoading && entry.models.some((item) => item.id === entry.model) && Boolean(entry.configured || entry.apiKey.trim())))
    })
  const save = async () => {
    if (pending.current || !canSave) return false
    pending.current = true
    setSaving(true)
    setError('')
    try {
      const doc = await request<AIConfigDocument>('/state/' + aiModelsSection, {
        method: 'PUT',
        body: JSON.stringify({
          revision: revision.current,
          data: {
            activeId,
            configurations: entries.map(({ id, provider, model, modelName, apiKey }) => ({ id, provider, model, modelName, apiKey: apiKey.trim() }))
          }
        })
      })
      cancelAll()
      generation.current++
      receive(doc, entries)
      window.dispatchEvent(new Event('ai-settings-saved'))
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
      return false
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  return { ready, loading, saving, busy: saving, error, entries, activeId, selectActive, connectionTests, testConnection, upsertEntry, removeEntry, changed, canSave, show, close, save }
}
