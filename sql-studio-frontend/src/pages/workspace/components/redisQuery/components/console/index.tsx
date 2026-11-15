import { LoadingOutlined } from '@ant-design/icons'
import { theme } from 'antd'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { redisCommandHints } from '@/databases/redis/editor'
import { useTranslation } from '@/hooks/useTranslation'
import { runCommand } from '@/services/redis'
import type { HistoryItem } from '@/typings/workspace'

import { readTerminal, saveTerminal, terminalCommandLimit, terminalHistoryLimit } from '../../utils/terminalSession'

type Entry = { index: number; prompt: string; command: string; answer?: string; error?: boolean; truncated?: boolean }

type Props = {
  page: string
  id: string
  database: number
  visible: boolean
  blocked: boolean
  connectionName: string
  loadedCommand?: HistoryItem
  onHistory: (item: HistoryItem) => void
  onBusy: (busy: boolean) => void
  onDatabase: (database: number) => void
}

export default function Console({ page, id, database, visible, blocked, connectionName, loadedCommand, onHistory, onBusy, onDatabase }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [initial] = useState(() => readTerminal(page, id))
  const [command, setCommand] = useState(initial.command)
  const [pending, setPending] = useState(false)
  const [entries, setEntries] = useState<Entry[]>(initial.entries)
  const request = useRef<AbortController | null>(null)
  const counter = useRef(initial.entries.at(-1)?.index ?? 0)
  const history = useRef(initial.history)
  const cursor = useRef<number | null>(null)
  const draft = useRef('')
  const scroll = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const prompt = `redis[${database}]>`
  const hints = redisCommandHints(command)

  const [lastLoad, setLastLoad] = useState(loadedCommand)
  if (lastLoad !== loadedCommand) {
    setLastLoad(loadedCommand)
    if (loadedCommand) setCommand(loadedCommand.sql)
  }

  useEffect(() => () => request.current?.abort(), [])
  useLayoutEffect(() => {
    saveTerminal(page, id, { command, entries, history: history.current })
  }, [page, id, command, entries])
  useLayoutEffect(() => {
    if (visible && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [entries, visible])
  useEffect(() => {
    if (visible) input.current?.focus({ preventScroll: true })
  }, [visible, loadedCommand])

  function record(value: string) {
    if (history.current.at(-1) !== value) history.current = [...history.current.slice(-(terminalHistoryLimit - 1)), value]
    cursor.current = null
    draft.current = ''
  }

  function recall(direction: -1 | 1) {
    const position = cursor.current ?? history.current.length
    if (direction < 0 && position === history.current.length) draft.current = command
    const index = Math.max(0, Math.min(history.current.length, position + direction))
    cursor.current = index === history.current.length ? null : index
    setCommand(history.current[index] ?? draft.current)
  }

  async function execute() {
    const value = command.trim()
    if (!value || request.current || blocked) return
    record(value)
    setCommand('')
    if (value.toLowerCase() === 'clear') {
      setEntries([])
      return
    }
    const controller = new AbortController()
    request.current = controller
    const entry = { index: ++counter.current, command, prompt }
    setEntries((previous) => [...previous.slice(-(terminalHistoryLimit - 1)), entry])
    setPending(true)
    onBusy(true)
    const started = performance.now()
    const saveHistory = (durationMs: number, error?: string) =>
      onHistory({
        id: crypto.randomUUID(),
        databaseType: 'redis',
        sql: value,
        connectionId: id,
        connectionName,
        database: String(database),
        time: new Date().toISOString(),
        durationMs,
        ok: !error,
        error
      })
    const complete = (update: Partial<Entry>) => setEntries((previous) => previous.map((item) => (item.index === entry.index ? { ...item, ...update } : item)))
    try {
      const result = await runCommand(id, database, value, controller.signal)
      controller.signal.throwIfAborted()
      if (result.database !== database) onDatabase(result.database)
      complete({ answer: result.output, truncated: result.truncated })
      saveHistory(result.result?.durationMs ?? Math.round(performance.now() - started))
    } catch (error) {
      if (!controller.signal.aborted) {
        const reason = error instanceof Error ? error.message : String(error)
        complete({ answer: reason, error: true })
        saveHistory(Math.round(performance.now() - started), reason)
      }
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) {
        setPending(false)
        onBusy(false)
      }
    }
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.altKey) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l' && !request.current) {
      event.preventDefault()
      setEntries([])
    } else if (!event.ctrlKey && !event.metaKey && event.key === 'Enter') {
      event.preventDefault()
      void execute()
    } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !request.current) {
      event.preventDefault()
      recall(event.key === 'ArrowUp' ? -1 : 1)
    }
  }

  return (
    <div
      ref={scroll}
      role="region"
      aria-label={t('Redis 终端')}
      hidden={!visible}
      onClick={(event) => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !event.currentTarget.contains(selection.anchorNode)) input.current?.focus({ preventScroll: true })
      }}
      style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--workspace-inset)', cursor: 'text', fontFamily: 'monospace', lineHeight: 1.65, userSelect: 'text' }}
    >
      <div role="log" aria-label={t('命令输出')}>
        {entries.map((entry) => (
          <div key={entry.index} style={{ marginBottom: token.marginXS, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            <div>
              <span style={{ color: token.colorTextSecondary }}>{entry.prompt}</span> {entry.command}
            </div>
            <div style={{ color: entry.error ? token.colorErrorText : token.colorText }}>
              {entry.answer === undefined ? <LoadingOutlined spin aria-label={t('执行中')} /> : entry.error ? t(entry.answer) : entry.answer || '""'}
            </div>
            {entry.truncated && <div style={{ color: token.colorTextSecondary }}>{t('仅显示部分内容')}</div>}
          </div>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'baseline', gap: token.marginXS, color: token.colorTextSecondary, width: '100%' }}>
        <span aria-hidden="true">{prompt}</span>
        <input
          type="text"
          ref={input}
          value={command}
          readOnly={pending || blocked}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          aria-label={t('Redis 命令')}
          maxLength={terminalCommandLimit}
          onChange={(event) => {
            cursor.current = null
            setCommand(event.target.value)
          }}
          onKeyDown={keys}
          style={{
            minWidth: 0,
            flex: 1,
            font: 'inherit',
            lineHeight: 'inherit',
            background: 'transparent',
            border: 0,
            outline: 'none',
            padding: 0,
            color: token.colorText,
            caretColor: token.colorText
          }}
        />
      </label>
      {hints.length > 0 && (
        <div aria-label={t('命令用法')} style={{ color: token.colorTextSecondary, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {hints.join(' · ')}
        </div>
      )}
    </div>
  )
}
