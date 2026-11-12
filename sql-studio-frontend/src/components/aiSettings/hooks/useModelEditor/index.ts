import { useEffect, useRef, useState } from 'react'

import { getAIAdapter } from '@/ai'
import type { AIProviderType, AISettingsEntry } from '@/ai/typings'

type Draft = Omit<AISettingsEntry, 'provider'> & { provider?: AIProviderType }
const modelLoadDelay = 500

export function useModelEditor(entries: readonly AISettingsEntry[], onCommit: (entry: AISettingsEntry) => boolean) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const request = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancelRequest = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    generation.current++
    request.current?.abort()
  }
  useEffect(() => () => cancelRequest(), [])

  const loadModels = async (value: Draft) => {
    if (!value.provider || (!value.apiKey.trim() && !value.configured)) return
    cancelRequest()
    const session = generation.current
    const controller = new AbortController()
    request.current = controller
    setDraft((current) => (current ? { ...current, modelsLoading: true, modelsError: '' } : null))
    try {
      const models = await getAIAdapter(value.provider).listModels(value.apiKey.trim(), controller.signal, value.configured ? value.id : undefined)
      if (session !== generation.current || controller.signal.aborted) return
      // Model discovery never selects or substitutes a model.
      setDraft((current) => (current ? { ...current, models, modelsLoading: false, modelsError: '' } : null))
    } catch (cause) {
      if (session === generation.current && !controller.signal.aborted)
        setDraft((current) => (current ? { ...current, modelsLoading: false, modelsError: cause instanceof Error ? cause.message : '连接失败' } : null))
    }
  }
  const show = (entry?: AISettingsEntry) => {
    cancelRequest()
    const value: Draft = entry
      ? { ...entry, modelsLoading: false, modelsError: '' }
      : { id: crypto.randomUUID(), apiKey: '', model: '', modelName: '', configured: false, models: [], modelsLoading: false, modelsError: '' }
    setDraft(value)
    setEditing(Boolean(entry))
    setError('')
    if (entry && (entry.configured || entry.apiKey.trim())) void loadModels(value)
  }
  const close = () => {
    cancelRequest()
    setDraft(null)
    setError('')
  }
  const changeProvider = (provider: AIProviderType) => {
    cancelRequest()
    setDraft((value) => (value ? { ...value, provider, apiKey: '', model: '', modelName: '', configured: false, models: [], modelsLoading: false, modelsError: '' } : null))
    setError('')
  }
  const changeKey = (apiKey: string) => {
    if (!draft) return
    cancelRequest()
    const canLoad = Boolean(draft.provider && (apiKey.trim() || draft.configured))
    const value: Draft = { ...draft, apiKey, model: '', modelName: '', models: [], modelsLoading: canLoad, modelsError: '' }
    setDraft(value)
    setError('')
    if (canLoad) timer.current = setTimeout(() => void loadModels(value), modelLoadDelay)
  }
  const changeModel = (model: string) => {
    setDraft((value) => (value ? { ...value, model, modelName: value.models.find((option) => option.id === model)?.name || '' } : null))
    setError('')
  }
  const duplicate = Boolean(draft?.model && entries.some((entry) => entry.id !== draft.id && entry.provider === draft.provider && entry.model === draft.model))
  const canCommit = Boolean(draft?.provider && draft.model && !draft.modelsLoading && draft.models.some((model) => model.id === draft.model) && (draft.configured || draft.apiKey.trim()) && !duplicate)
  const commit = () => {
    if (!draft?.provider || !canCommit) return
    if (onCommit({ ...draft, provider: draft.provider })) close()
    else setError('无法添加：供应商与模型重复，或配置数量已达上限')
  }
  const usedModels = entries.filter((entry) => entry.id !== draft?.id && entry.provider === draft?.provider).map((entry) => entry.model)
  return { draft, editing, error, duplicate, usedModels, canCommit, show, close, changeProvider, changeKey, changeModel, refreshModels: () => draft && loadModels(draft), commit }
}
