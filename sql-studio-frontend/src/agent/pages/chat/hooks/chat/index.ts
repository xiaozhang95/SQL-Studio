import { Form } from 'antd'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { WorkspaceController } from '../../../../hooks/workspace'
import * as api from '../../../../services/chat'
import type { ChatEvent, Entry, TokenUsage } from '../../../../typings/chat'
import type { ConversationInfo } from '../../../../typings/workspace'
import { applyEvent } from '../../../../utils/chatEvents'
import { CHAT } from '../../constant/chat'
import { useWriteConfirmation } from '../writeConfirmation'

export function useChat(workspace: WorkspaceController, mode: 'readonly' | 'write' = 'readonly') {
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [managing, setManaging] = useState(false)
  const mutation = useRef(false)
  const historyVersion = useRef(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [history, setHistory] = useState<ConversationInfo[]>([])
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<TokenUsage | null>(null)
  const [form] = Form.useForm<{ question: string }>()
  const session = useRef('')
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
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
    if (!workspace.ready) return
    const c = new AbortController()
    async function initialize() {
      try {
        const items = await api.ensureHistory(c.signal)
        const initial = initialState.current
        const selected = items.find((i) => i.id === initial.activeId)?.id ?? items[0]?.id
        if (!selected) throw new Error('无法创建默认会话')
        const view = await api.view(selected, c.signal)
        if (c.signal.aborted) return
        setHistory(items)
        session.current = selected
        setEntries(view.events.reduce(applyEvent, []))
        setUsage([...view.events].reverse().find((e) => e.usage)?.usage ?? null)
        const same = !initial.activeId || initial.activeId === selected
        form.setFieldsValue({ question: same ? initial.draft : '' })
        latestWorkspace.current.update({ activeId: selected, draft: same ? initial.draft : '', expanded: same ? initial.expanded : [] })
        if (view.busy) setError('该对话正在另一个窗口执行，待完成后重新打开历史记录。')
      } catch (cause) {
        if (!c.signal.aborted) setError(cause instanceof Error ? cause.message : '读取会话失败')
      } finally {
        if (!c.signal.aborted) {
          setLoading(false)
          setHistoryLoading(false)
        }
      }
    }
    void initialize()
    return () => c.abort()
  }, [workspace.ready, form])
  const confirmWrite = useWriteConfirmation()
  function event(e: ChatEvent) {
    if (e.type === 'write_confirmation' && active.current) {
      confirmWrite.show(e.result, active.current.signal)
      return
    }
    if (e.type === 'error' || e.type === 'done') confirmWrite.close()
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
  function activate(id: string, events: ChatEvent[] = []) {
    session.current = id
    setEntries(events.reduce(applyEvent, []))
    setUsage([...events].reverse().find((e) => e.usage)?.usage ?? null)
    setError('')
    setStatus('')
    form.resetFields()
    latestWorkspace.current.update({ activeId: id, draft: '', expanded: [] })
  }
  async function createNew() {
    if (active.current || loading || mutation.current) return
    mutation.current = true
    historyVersion.current++
    setManaging(true)
    setError('')
    try {
      const id = await api.create()
      const items = await api.list()
      if (!mounted.current) return
      setHistory(items)
      activate(id)
      setHistoryOpen(false)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '新建会话失败')
    } finally {
      mutation.current = false
      if (mounted.current) setManaging(false)
    }
  }
  async function deleteHistory(id: string) {
    if (active.current || loading || mutation.current) return
    mutation.current = true
    historyVersion.current++
    setManaging(true)
    setError('')
    try {
      await api.remove(id)
      const items = await api.ensureHistory()
      const selected = items.find((i) => i.id === session.current)?.id ?? items[0]?.id
      if (!selected) throw new Error('无法恢复会话列表')
      const next = session.current !== selected ? await api.view(selected, new AbortController().signal) : null
      if (!mounted.current) return
      setHistory(items)
      if (next) activate(selected, next.events)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '删除会话失败')
      throw cause
    } finally {
      mutation.current = false
      if (mounted.current) setManaging(false)
    }
  }
  async function renameHistory(id: string, title: string) {
    if (active.current || loading || mutation.current) throw new Error('请等待当前操作完成')
    mutation.current = true
    historyVersion.current++
    setManaging(true)
    try {
      const renamed = await api.rename(id, title)
      if (mounted.current) setHistory((old) => old.map((item) => (item.id === id ? renamed : item)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    } finally {
      mutation.current = false
      if (mounted.current) setManaging(false)
    }
  }
  async function refreshHistory() {
    if (mutation.current) return
    const version = historyVersion.current
    const previous = session.current
    setHistoryLoading(true)
    try {
      const items = await api.ensureHistory()
      if (!mounted.current || version !== historyVersion.current || previous !== session.current) return
      setHistory(items)
      if (!items.some((item) => item.id === session.current) && items[0]) {
        const view = await api.view(items[0].id, new AbortController().signal)
        if (mounted.current && version === historyVersion.current && previous === session.current) activate(items[0].id, view.events)
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '读取历史失败')
    } finally {
      if (mounted.current) setHistoryLoading(false)
    }
  }
  function showHistory() {
    setHistoryOpen(true)
    void refreshHistory()
  }
  async function selectHistory(id: string) {
    if (active.current || loading || mutation.current) return
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
    if (active.current || loading || mutation.current || !workspace.ready || !text.trim()) return
    const c = new AbortController()
    active.current = c
    setBusy(true)
    setError('')
    setEntries((old) => applyEvent(old, { type: 'user', text, createdAt: new Date().toISOString() }))
    form.resetFields()
    workspace.update({ draft: '' })
    try {
      if (!session.current) {
        session.current = await api.create(c.signal)
        latestWorkspace.current.update({ activeId: session.current })
      }
      await api.chat(
        session.current,
        text,
        c.signal,
        (e) => {
          if (mounted.current) event(e)
        },
        mode
      )
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
    editQuestion: (text: string) => {
      if (active.current || loading || mutation.current) return
      form.setFieldValue('question', text)
      latestWorkspace.current.update({ draft: text })
      form.scrollToField('question', { focus: true })
    },
    entries,
    status: confirmWrite.pending ? '等待确认数据库操作' : status,
    confirmWrite,
    busy: busy || loading || managing,
    deleteHistory,
    loading,
    error,
    usage,
    form,
    createNew,
    renameHistory,
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
