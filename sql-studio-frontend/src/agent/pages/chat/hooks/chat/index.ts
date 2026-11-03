import { Form } from 'antd'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { WorkspaceController } from '../../../../hooks/workspace'
import * as api from '../../../../services/chat'
import type { ChatEvent, Entry, TokenUsage } from '../../../../typings/chat'
import type { ConversationInfo } from '../../../../typings/workspace'
import { applyEvent } from '../../../../utils/chatEvents'
import { CHAT } from '../../constant/chat'

export function useChat(workspace: WorkspaceController) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(Boolean(workspace.state.activeId))
  const [deleting, setDeleting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [history, setHistory] = useState<ConversationInfo[]>([])
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<TokenUsage | null>(null)
  const [form] = Form.useForm<{ question: string }>()
  const session = useRef('')
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const loaded = useRef(false)
  const latestWorkspace = useRef(workspace)
  const initialState = useRef(workspace.state)
  useLayoutEffect(() => {
    latestWorkspace.current = workspace
  }, [workspace])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!workspace.ready || loaded.current) return
    loaded.current = true
    const c = new AbortController()
    session.current = initialState.current.activeId
    form.setFieldsValue({ question: initialState.current.draft })
    if (session.current) {
      api
        .view(session.current, c.signal)
        .then((v) => {
          if (c.signal.aborted) return
          setEntries(v.events.reduce(applyEvent, []))
          const lastUsage = [...v.events].reverse().find((e) => e.usage)?.usage
          setUsage(lastUsage ?? null)
          if (v.busy) setError('该对话正在另一个窗口执行，待完成后重新打开历史记录。')
        })
        .catch((e: Error) => {
          if (!c.signal.aborted) setError(e.message)
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false)
        })
    }
    return () => {
      c.abort()
      loaded.current = false
    }
  }, [workspace.ready, form])
  useEffect(() => {
    if (!workspace.ready) return
    const c = new AbortController()
    api
      .list(c.signal)
      .then((v) => {
        if (!c.signal.aborted) setHistory(v)
      })
      .catch((e: Error) => {
        if (!c.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!c.signal.aborted) setHistoryLoading(false)
      })
    return () => c.abort()
  }, [workspace.ready])
  function event(e: ChatEvent) {
    setEntries((old) => applyEvent(old, e))
    if (e.type === 'status') setStatus(e.text ?? '')
    if (e.type === 'tool_start') setStatus(`${CHAT.tools[e.tool ?? ''] ?? '正在处理'}…`)
    const u = e.usage
    if (u)
      setUsage((old) => ({
        ...u,
        estimatedTokens: u.estimatedTokens ?? old?.estimatedTokens
      }))
  }
  function resetConversation() {
    session.current = ''
    setEntries([])
    setError('')
    setUsage(null)
    setStatus('')
    form.resetFields()
    latestWorkspace.current.update({ activeId: '', draft: '', expanded: [] })
  }
  function clear() {
    if (active.current || loading || deleting) return
    resetConversation()
  }
  async function deleteHistory(id: string) {
    if (active.current || loading || deleting) return
    setDeleting(true)
    setError('')
    try {
      await api.remove(id)
      setHistory((old) => old.filter((i) => i.id !== id))
      if (session.current === id) resetConversation()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除会话失败')
      throw e
    } finally {
      setDeleting(false)
    }
  }
  async function refreshHistory() {
    setHistoryLoading(true)
    try {
      const items = await api.list()
      if (mounted.current) setHistory(items)
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : '读取历史失败')
    } finally {
      if (mounted.current) setHistoryLoading(false)
    }
  }
  function showHistory() {
    setHistoryOpen(true)
    void refreshHistory()
  }
  async function selectHistory(id: string) {
    if (active.current || loading || deleting) return
    const c = new AbortController()
    setLoading(true)
    setError('')
    try {
      const v = await api.view(id, c.signal)
      if (v.busy) {
        setError('该对话正在执行，请稍后重新打开。')
        return
      }
      session.current = id
      setEntries(v.events.reduce(applyEvent, []))
      setUsage([...v.events].reverse().find((e) => e.usage)?.usage ?? null)
      setHistoryOpen(false)
      form.resetFields()
      workspace.update({ activeId: id, draft: '', expanded: [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取记录失败')
    } finally {
      setLoading(false)
    }
  }
  async function send({ question: text }: { question: string }) {
    if (active.current || loading || deleting || !workspace.ready || !text.trim()) return
    const c = new AbortController()
    active.current = c
    setBusy(true)
    setError('')
    setEntries((old) => applyEvent(old, { type: 'user', text }))
    form.resetFields()
    workspace.update({ draft: '' })
    try {
      if (!session.current) {
        session.current = await api.create(c.signal)
        latestWorkspace.current.update({ activeId: session.current })
      }
      await api.chat(session.current, text, c.signal, (e) => {
        if (mounted.current) event(e)
      })
    } catch (e) {
      if (mounted.current)
        event({
          type: 'error',
          text: c.signal.aborted ? '已停止，当前轮次未完成。' : e instanceof Error ? e.message : '请求失败'
        })
    } finally {
      active.current = null
      if (mounted.current) {
        setBusy(false)
        setStatus('')
        void refreshHistory()
      }
    }
  }
  return {
    entries,
    status,
    busy: busy || loading || deleting,
    deleteHistory,
    loading,
    error,
    usage,
    form,
    clear,
    send,
    stop: () => active.current?.abort(),
    historyOpen,
    history,
    historyLoading,
    refreshHistory,
    showHistory,
    selectHistory,
    closeHistory: () => setHistoryOpen(false),
    onDraftChange: (_: unknown, values: { question?: string }) => workspace.update({ draft: values.question ?? '' })
  }
}
