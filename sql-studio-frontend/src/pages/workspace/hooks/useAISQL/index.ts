import type { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getAIAdapter, isAIProvider } from '@/ai'
import { aiModelsSection } from '@/ai/typings'
import type { AIConfigDocument, AIProviderType } from '@/ai/typings'
import { getDatabaseAdapter } from '@/databases'
import type { DatabaseType } from '@/databases/typings'
import type { AIResult } from '@/typings/ai'
import type { QueryScope } from '@/typings/workspace'
import { request } from '@/utils/request'

import { aiCompletion } from '../../utils/aiCompletion'
import { buildAIContext } from '../../utils/aiContext'
import type { useDatabaseObjects } from '../useDatabaseObjects'

type Preview = { result: AIResult; original: string; document: EditorView['state']['doc']; from: number; to: number; view: EditorView }
export function useAISQL(scope: QueryScope & { sql: string }, objects: ReturnType<typeof useDatabaseObjects>, blocked: boolean, databaseType?: DatabaseType) {
  const layout = getDatabaseAdapter(databaseType).explorer
  const snapshot = objects.snapshots[scope.connectionId]
  const tables = snapshot?.status === 'connected' ? snapshot.tables[scope.database] : undefined
  const structures = snapshot?.structures
  const editor = useRef<EditorView | null>(null)
  const [configured, setConfigured] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [provider, setProvider] = useState<AIProviderType>(getAIAdapter().profile.value)
  const [settingsRevision, setSettingsRevision] = useState(0)
  const [completionLoading, setCompletionLoading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const scopeKey = JSON.stringify([scope.connectionId, scope.database, scope.schema, scope.table, databaseType])
  const [requestScope, setRequestScope] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const controller = useRef<AbortController | null>(null)
  const preferenceRequest = useRef<AbortController | null>(null)
  const [preferenceSaving, setPreferenceSaving] = useState(false)
  const [preferenceError, setPreferenceError] = useState('')
  useEffect(() => () => preferenceRequest.current?.abort(), [])

  useEffect(() => {
    let alive = true
    let latest = 0
    const refresh = () => {
      const current = ++latest
      void request<AIConfigDocument>('/state/' + aiModelsSection)
        .then((doc) => {
          if (alive && current === latest) {
            setCompletionLoading(false)
            const entries = doc.data === null ? [] : doc.data.configurations
            if (!Array.isArray(entries) || entries.some((entry) => !isAIProvider(entry.provider) || !entry.model || !entry.modelName)) throw new Error('模型列表配置无效')
            const selected = entries.find((entry) => entry.id === doc.data?.activeId && entry.configured)
            setConfigured(Boolean(selected))
            setEnabled(doc.data?.completionEnabled !== false)
            if (selected) setProvider(selected.provider)
            setSettingsRevision(doc.revision)
          }
        })
        .catch(() => {
          if (alive && current === latest) {
            setConfigured(false)
          }
        })
    }
    refresh()
    window.addEventListener('ai-settings-saved', refresh)
    return () => {
      alive = false
      window.removeEventListener('ai-settings-saved', refresh)
    }
  }, [])
  useEffect(
    () => () => {
      controller.current?.abort()
    },
    [scopeKey]
  )
  const complete = useCallback(
    async (prefix: string, suffix: string, document: string, signal: AbortSignal) => {
      if (signal.aborted) return ''
      const context = buildAIContext(
        { connectionId: scope.connectionId, database: scope.database, schema: scope.schema, table: scope.table },
        tables || [],
        structures || {},
        `${document}\n${prefix}\n${suffix}`,
        layout
      )
      return (await getAIAdapter(provider).assist({ ...context, action: 'complete', prefix, suffix, document }, signal)).completion || ''
    },
    [scope.connectionId, scope.database, scope.schema, scope.table, tables, structures, provider, layout]
  )
  const extensions = useMemo(() => {
    if (!configured || !enabled || blocked) return []
    // 修订改变时重建扩展，取消旧模型/Key/开关对应的在途建议。
    void settingsRevision
    return aiCompletion({
      complete,
      loading: setCompletionLoading
    })
  }, [complete, configured, enabled, blocked, setCompletionLoading, settingsRevision])
  const close = () => {
    controller.current?.abort()
    setOpen(false)
    setPreview(null)
    setLoading(false)
  }
  const updatePreference = async (update: { completionEnabled: boolean }) => {
    if (blocked || preferenceRequest.current) return
    const pending = new AbortController()
    preferenceRequest.current = pending
    setPreferenceSaving(true)
    setPreferenceError('')
    try {
      const doc = await request<AIConfigDocument>('/state/' + aiModelsSection, { signal: pending.signal })
      if (!doc.data || !Array.isArray(doc.data.configurations)) throw new Error('请先添加 AI 模型')
      await request<AIConfigDocument>('/state/' + aiModelsSection, {
        method: 'PUT',
        signal: pending.signal,
        body: JSON.stringify({
          revision: doc.revision,
          data: {
            ...doc.data,
            ...update,
            configurations: doc.data.configurations.map(({ id, provider, model, modelName }) => ({ id, provider, model, modelName }))
          }
        })
      })
      if (!pending.signal.aborted) window.dispatchEvent(new Event('ai-settings-saved'))
    } catch (cause) {
      if (!pending.signal.aborted) setPreferenceError(cause instanceof Error ? cause.message : 'AI 设置保存失败')
    } finally {
      if (preferenceRequest.current === pending) preferenceRequest.current = null
      if (!pending.signal.aborted) setPreferenceSaving(false)
    }
  }
  const changeCompletion = (value: boolean) => (configured ? updatePreference({ completionEnabled: value }) : undefined)
  const optimize = async (selectionOnly = false, selectedSQL?: string) => {
    const view = editor.current
    if (!view || blocked || (loading && requestScope === scopeKey)) return
    const doc = view.state.doc
    const selection = view.state.selection.main
    if (selectionOnly && selection.empty) return
    const from = selectionOnly ? selection.from : 0
    const to = selectionOnly ? selection.to : doc.length
    const original = selectedSQL ?? doc.sliceString(from, to)
    // 右键捕获的原选区内容必须仍匹配；不回退到整页 SQL。
    if (selectedSQL !== undefined && doc.sliceString(from, to) !== selectedSQL) return
    if (!original.trim()) return
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setRequestScope(scopeKey)
    setOpen(true)
    setLoading(true)
    setError('')
    setPreview(null)
    try {
      const context = buildAIContext(scope, snapshot?.status === 'connected' ? snapshot.tables[scope.database] || [] : [], snapshot?.structures || {}, original, layout)
      const referenced = layout?.referencedTables?.(original, tables || [], scope.schema)
      const result = await getAIAdapter(provider).assist(
        { ...context, tables: context.tables.filter((table) => (referenced ? referenced.has(table.name) : original.includes(table.name))), action: 'optimize', sql: original },
        current.signal
      )
      if (!current.signal.aborted) setPreview({ result, original, document: doc, from, to, view })
    } catch (cause) {
      if (!current.signal.aborted) setError(cause instanceof Error ? cause.message : 'SQL 优化失败')
    } finally {
      if (!current.signal.aborted) setLoading(false)
    }
  }
  const apply = () => {
    const view = editor.current
    if (requestScope !== scopeKey || !preview || !view || view !== preview.view || view.state.doc !== preview.document || blocked) {
      setError('原 SQL 已变化，请关闭后重新优化。')
      return
    }
    view.dispatch({ changes: { from: preview.from, to: preview.to, insert: preview.result.sql || '' }, userEvent: 'input.ai' })
    close()
    view.focus()
  }
  const onEditorReady = (view: EditorView) => {
    editor.current = view
  }
  return {
    onEditorReady,
    configured,
    enabled,
    changeCompletion,
    preferenceSaving,
    preferenceError,
    clearPreferenceError: () => setPreferenceError(''),
    completionLoading,
    extensions,
    error,
    loading: loading && requestScope === scopeKey,
    open: open && requestScope === scopeKey,
    preview,
    optimize,
    close,
    apply
  }
}
