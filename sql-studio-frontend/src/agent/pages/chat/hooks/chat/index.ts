import { Form } from 'antd'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { WorkspaceController } from '../../../../hooks/workspace'
import * as api from '../../../../services/chat'
import type { ChatEvent, Entry, TokenUsage } from '../../../../typings/chat'
import type { ConversationInfo } from '../../../../typings/workspace'
import { applyEvent, restoreEvents } from '../../../../utils/chatEvents'
import { CHAT } from '../../constant/chat'
import { useWriteConfirmation } from '../writeConfirmation'

const missingHistoryMessage = '当前会话未出现在最新列表中，已保留当前内容。请重试刷新或手动选择其他会话。'

export function useChat(workspace: WorkspaceController, mode: 'readonly' | 'write' = 'readonly') {
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)
  const [managing, setManaging] = useState(false)
  const mutation = useRef(false)
  const historyVersion = useRef(0)
  const historyRefresh = useRef(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [history, setHistory] = useState<ConversationInfo[]>([])
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<TokenUsage | null>(null)
  const [form] = Form.useForm<{ question: string }>()
  const session = useRef('')
  const active = useRef<AbortController | null>(null)
  const activeText = useRef('')
  const reading = useRef<AbortController | null>(null)
  const [loadError, setLoadError] = useState('')
  const [initializeAttempt, setInitializeAttempt] = useState(0)
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
      reading.current?.abort()
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
        if (c.signal.aborted) return
        setHistory(items)
        setHistoryLoading(false)
        reading.current = c
        setInitializing(false)
        session.current = selected
        const same = !initial.activeId || initial.activeId === selected
        form.setFieldsValue({ question: same ? initial.draft : '' })
        latestWorkspace.current.update({ activeId: selected, draft: same ? initial.draft : '', expanded: same ? initial.expanded : [] })
        const view = await api.view(selected, c.signal)
        if (view.busy) throw new Error('该对话正在另一个窗口执行，请稍后重试。')
        const restored = await restoreEvents(view.events, c.signal)
        if (c.signal.aborted) return
        setEntries(restored)
        setUsage([...view.events].reverse().find((e) => e.usage)?.usage ?? null)
      } catch (cause) {
        if (!c.signal.aborted) setLoadError(cause instanceof Error ? cause.message : '读取会话失败')
      } finally {
        if (!c.signal.aborted) {
          if (reading.current === c) reading.current = null
          setLoading(false)
          setInitializing(false)
          setHistoryLoading(false)
        }
      }
    }
    void initialize()
    return () => c.abort()
  }, [workspace.ready, form, initializeAttempt])
  const confirmWrite = useWriteConfirmation()
  function event(e: ChatEvent) {
    if ((e.type === 'write_confirmation' || e.type === 'continue_confirmation') && active.current) {
      confirmWrite.show(e.result, active.current.signal, e.type === 'continue_confirmation')
      return
    }
    if (e.type === 'error' || e.type === 'stopped' || e.type === 'done') confirmWrite.close()
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
  async function activate(id: string, events: ChatEvent[] = []) {
    reading.current?.abort()
    const controller = new AbortController()
    reading.current = controller
    setLoading(true)
    let restored: Entry[]
    try {
      restored = await restoreEvents(events, controller.signal)
    } catch (cause) {
      if (controller.signal.aborted) return
      throw cause
    } finally {
      if (reading.current === controller) {
        reading.current = null
        if (mounted.current) setLoading(false)
      }
    }
    if (!mounted.current || controller.signal.aborted) return
    setLoadError('')
    session.current = id
    setEntries(restored)
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
      await activate(id)
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
      const removingCurrent = id === session.current
      await api.remove(id)
      const items = await (removingCurrent ? api.ensureHistory() : api.list())
      const selected = removingCurrent ? items[0]?.id : session.current
      if (!selected) throw new Error('无法恢复会话列表')
      const next = session.current !== selected ? await api.view(selected, new AbortController().signal) : null
      if (!mounted.current) return
      if (next) {
        setHistory(items)
        await activate(selected, next.events)
      } else updateHistory(items)
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
  function updateHistory(items: ConversationInfo[]) {
    const selected = session.current
    const missing = Boolean(selected && !items.some((item) => item.id === selected))
    setHistory((old) => {
      const current = missing ? old.find((item) => item.id === selected) : undefined
      return current ? [current, ...items] : items
    })
    setError((old) => (missing ? missingHistoryMessage : old === missingHistoryMessage ? '' : old))
  }
  async function refreshHistory() {
    if (mutation.current || reading.current || loading) return
    const request = ++historyRefresh.current
    const version = historyVersion.current
    const previous = session.current
    const current = () => mounted.current && request === historyRefresh.current && version === historyVersion.current && previous === session.current
    setHistoryLoading(true)
    try {
      const items = await api.list()
      if (!current()) return
      updateHistory(items)
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : '读取历史失败')
    } finally {
      if (mounted.current && request === historyRefresh.current) setHistoryLoading(false)
    }
  }
  function showHistory() {
    setHistoryOpen(true)
    void refreshHistory()
  }
  async function selectHistory(id: string, retry = false) {
    if (active.current || mutation.current || !workspace.ready) return
    if (session.current === id && !retry) return
    reading.current?.abort()
    const c = new AbortController()
    reading.current = c
    historyVersion.current++
    session.current = id
    setEntries([])
    setUsage(null)
    setStatus('')
    setLoading(true)
    setError('')
    setLoadError('')
    if (!retry) {
      form.resetFields()
      latestWorkspace.current.update({ activeId: id, draft: '', expanded: [] })
    }
    setHistoryOpen(false)
    try {
      // Let the selected title and loading placeholder paint before reading content.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      c.signal.throwIfAborted()
      const v = await api.view(id, c.signal)
      if (v.busy) throw new Error('该对话正在执行，请稍后重试。')
      const restored = await restoreEvents(v.events, c.signal)
      if (!mounted.current || c.signal.aborted || reading.current !== c || session.current !== id) return
      setEntries(restored)
      setUsage([...v.events].reverse().find((e) => e.usage)?.usage ?? null)
    } catch (cause) {
      if (mounted.current && !c.signal.aborted && reading.current === c) setLoadError(cause instanceof Error ? cause.message : '读取记录失败')
    } finally {
      if (mounted.current && reading.current === c) {
        reading.current = null
        setLoading(false)
      }
    }
  }
  async function send({ question: text }: { question: string }) {
    if (active.current || reading.current || loading || loadError || mutation.current || !workspace.ready || !text.trim()) return
    if (new TextEncoder().encode(text).length > CHAT.maxQuestionBytes) return
    const c = new AbortController()
    active.current = c
    activeText.current = text
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
      if (c.signal.aborted && mounted.current && session.current) {
        // The HTTP stream can close before the server finishes saving the stopped turn.
        const id = session.current
        const settling = AbortSignal.timeout(5000)
        try {
          while (mounted.current && (await api.sessionBusy(id, settling))) {
            await new Promise<void>((resolve) => setTimeout(resolve, 150))
          }
        } catch {
          // Leave the stopped turn visible even if the backend went away.
        }
      }
      active.current = null
      if (mounted.current) {
        setBusy(false)
        setStatus('')
        void refreshHistory()
      }
    }
  }
  async function decideConfirmation(allow: boolean) {
    const pending = confirmWrite.pending
    const controller = active.current
    const id = session.current
    const returnToEdit = !allow && pending && 'kind' in pending && pending.kind === 'input'
    const text = returnToEdit ? activeText.current : ''
    const accepted = await confirmWrite.decide(allow)
    if (returnToEdit && accepted && mounted.current && session.current === id && (!active.current || active.current === controller)) {
      form.setFieldValue('question', text)
      latestWorkspace.current.update({ draft: text })
    }
  }
  return {
    editQuestion: (text: string) => {
      if (active.current || reading.current || loading || loadError || mutation.current) return
      form.setFieldValue('question', text)
      latestWorkspace.current.update({ draft: text })
      form.scrollToField('question', { focus: true })
    },
    loadError,
    retryHistory: () => {
      if (session.current) return selectHistory(session.current, true)
      setInitializing(true)
      setLoading(true)
      setLoadError('')
      setInitializeAttempt((value) => value + 1)
    },
    historyBusy: busy || managing || !workspace.ready || initializing,
    entries,
    status: confirmWrite.pending ? ('kind' in confirmWrite.pending ? '等待选择是否继续' : '等待确认数据库操作') : status,
    confirmWrite,
    decideConfirmation,
    busy: busy || loading || managing || Boolean(loadError),
    inFlight: busy || loading || managing,
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
    onDraftChange: (_: unknown, values: { question?: string }) => {
      const draft = values.question ?? ''
      if (new TextEncoder().encode(draft).length <= CHAT.maxQuestionBytes) workspace.update({ draft })
    }
  }
}
