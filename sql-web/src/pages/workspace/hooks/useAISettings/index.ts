import { useEffect, useRef, useState } from 'react'

import { aiProviders, getAIAdapter, isAIProvider } from '@/ai'
import type { AIConfigDocument, AIModel, AIProviderType } from '@/ai/typings'
import { request } from '@/utils/request'

/** 表单与官方模型发现各自取消，Key 只保留于当前弹窗。 */
export function useAISettings() {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const busy = saving || removing
  const [error, setError] = useState('')
  const [configured, setConfigured] = useState(false)
  const [apiKey, setAPIKey] = useState('')
  const [provider, setProvider] = useState<AIProviderType>(aiProviders[0].value)
  const [model, setModel] = useState(getAIAdapter().profile.defaultModel)
  const [completionEnabled, setCompletionEnabled] = useState(true)
  const [models, setModels] = useState<AIModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const revision = useRef(0)
  const generation = useRef(0)
  const modelRequest = useRef<AbortController | null>(null)
  const modelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(modelTimer.current)
      modelRequest.current?.abort()
      generation.current++
    },
    []
  )
  const loadModels = async (target: AIProviderType, key: string, selected: string, session: number) => {
    clearTimeout(modelTimer.current)
    modelRequest.current?.abort()
    const controller = new AbortController()
    modelRequest.current = controller
    setModelsLoading(true)
    setModelsError('')
    try {
      const values = await getAIAdapter(target).listModels(key.trim(), controller.signal)
      if (session !== generation.current || controller.signal.aborted) return
      setModels(values)
      const preferred = values.find((item) => item.id === selected) || values.find((item) => item.id === getAIAdapter(target).profile.defaultModel) || values[0]
      setModel(preferred.id)
    } catch (cause) {
      if (session === generation.current && !controller.signal.aborted) setModelsError(cause instanceof Error ? cause.message : '获取模型失败')
    } finally {
      if (session === generation.current && !controller.signal.aborted) setModelsLoading(false)
    }
  }
  const show = async () => {
    if (busy) return
    const id = ++generation.current
    clearTimeout(modelTimer.current)
    modelRequest.current?.abort()
    setOpen(true)
    setLoading(true)
    setReady(false)
    setConfigured(false)
    setModels([])
    setModelsError('')
    setModelsLoading(false)
    setError('')
    setAPIKey('')
    try {
      const doc = await request<AIConfigDocument>('/state/ai')
      if (id !== generation.current) return
      if (!Number.isSafeInteger(doc.revision) || (doc.data !== null && !isAIProvider(doc.data.provider))) throw new Error('AI 配置无效')
      const target = doc.data?.provider || aiProviders[0].value
      const selected = doc.data?.model || getAIAdapter(target).profile.defaultModel
      revision.current = doc.revision
      setProvider(target)
      setModel(selected)
      setCompletionEnabled(doc.data?.completionEnabled !== false)
      setConfigured(doc.data?.configured === true)
      setReady(true)
      if (doc.data?.configured) void loadModels(target, '', selected, id)
    } catch (cause) {
      if (id === generation.current) setError(cause instanceof Error ? cause.message : '读取失败')
    } finally {
      if (id === generation.current) setLoading(false)
    }
  }
  const changeKey = (value: string) => {
    clearTimeout(modelTimer.current)
    modelRequest.current?.abort()
    setModels([])
    setModelsError('')
    setAPIKey(value)
    const canLoad = Boolean(value.trim() || configured)
    setModelsLoading(canLoad)
    if (canLoad) {
      const session = generation.current
      modelTimer.current = setTimeout(() => void loadModels(provider, value, model, session), 500)
    }
  }
  const close = () => {
    if (busy) return
    generation.current++
    clearTimeout(modelTimer.current)
    modelRequest.current?.abort()
    setOpen(false)
    setAPIKey('')
  }
  const refreshModels = () => loadModels(provider, apiKey, model, generation.current)
  const save = async () => {
    if (!ready || busy || modelsLoading || !models.some((item) => item.id === model)) return
    setSaving(true)
    setError('')
    try {
      await request<AIConfigDocument>('/state/ai', { method: 'PUT', body: JSON.stringify({ revision: revision.current, data: { provider, model, completionEnabled, apiKey: apiKey.trim() } }) })
      window.dispatchEvent(new Event('ai-settings-saved'))
      generation.current++
      clearTimeout(modelTimer.current)
      modelRequest.current?.abort()
      setAPIKey('')
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!ready || !configured || busy) return
    setRemoving(true)
    setError('')
    clearTimeout(modelTimer.current)
    modelRequest.current?.abort()
    try {
      await request<AIConfigDocument>('/ai/config', { method: 'DELETE', body: JSON.stringify({ revision: revision.current }) })
      generation.current++
      setAPIKey('')
      setConfigured(false)
      setCompletionEnabled(false)
      setModels([])
      setOpen(false)
      window.dispatchEvent(new Event('ai-settings-saved'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '移除失败')
    } finally {
      setModelsLoading(false)
      setRemoving(false)
    }
  }
  return {
    ready,
    open,
    loading,
    saving,
    removing,
    busy,
    remove,
    error,
    configured,
    apiKey,
    changeKey,
    show,
    close,
    save,
    provider,
    model,
    setModel,
    completionEnabled,
    setCompletionEnabled,
    models,
    modelsLoading,
    modelsError,
    refreshModels
  }
}
