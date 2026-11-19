import { LoadingOutlined } from '@ant-design/icons'
import type { EditorView } from '@codemirror/view'
import { theme } from 'antd'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { usePageError } from '@/contexts/pageErrors'
import { redisCommandHints } from '@/databases/redis/editor'
import { useTranslation } from '@/hooks/useTranslation'
import { runCommand } from '@/services/redis'
import type { ThemeMode } from '@/typings/theme'
import type { HistoryItem } from '@/typings/workspace'

import { readTerminal, saveTerminal, terminalHistoryLimit } from '../../utils/terminalSession'
import ConsoleInput from '../consoleInput'

type Entry = { index: number; prompt: string; command: string; answer?: string; error?: boolean; truncated?: boolean }

type Props = {
  page: string
  id: string
  database: number
  databases: readonly string[]
  visible: boolean
  themeMode: ThemeMode
  blocked: boolean
  connectionName: string
  host: string
  loadedCommand?: HistoryItem
  onHistory: (item: HistoryItem) => void
  onBusy: (busy: boolean) => void
  onDatabase: (database: number) => void
}

const selectHintLimit = 16

export default function Console({ page, id, database, databases, visible, themeMode, blocked, connectionName, host, loadedCommand, onHistory, onBusy, onDatabase }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [initial] = useState(() => readTerminal(page, id))
  const [command, setCommand] = useState(initial.command)
  const [selection, setSelection] = useState(initial.selection)
  const [pending, setPending] = useState(false)
  const [entries, setEntries] = useState<Entry[]>(initial.entries)
  const latest = entries.at(-1)
  usePageError(visible && latest?.error ? latest.answer : undefined, latest ? String(latest.index) : undefined)
  const request = useRef<AbortController | null>(null)
  const counter = useRef(initial.entries.at(-1)?.index ?? 0)
  const history = useRef(initial.history)
  const cursor = useRef<number | null>(null)
  const draft = useRef('')
  const scroll = useRef<HTMLDivElement>(null)
  const input = useRef<EditorView | null>(null)
  const prompt = `${host}:db${database}>`
  const databaseHint = databases.length ? `${t('可选逻辑库')} ${databases.slice(0, selectHintLimit).join(', ')}${databases.length > selectHintLimit ? ', …' : ''}` : undefined
  const hints = redisCommandHints(command, databaseHint)

  const [lastLoad, setLastLoad] = useState(loadedCommand)
  if (lastLoad !== loadedCommand) {
    setLastLoad(loadedCommand)
    if (loadedCommand) setCommand(loadedCommand.sql)
  }

  useEffect(() => () => request.current?.abort(), [])
  useLayoutEffect(() => {
    saveTerminal(page, id, { command, selection, entries, history: history.current })
  }, [page, id, command, selection, entries])
  useLayoutEffect(() => {
    if (visible && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [entries, visible])
  useEffect(() => {
    if (visible) input.current?.focus()
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
    if (request.current || blocked) return
    if (!value) {
      const entry = { index: ++counter.current, command: '', prompt, answer: '' }
      setEntries((previous) => [...previous.slice(-(terminalHistoryLimit - 1)), entry])
      setCommand('')
      return
    }
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

  return (
    <div
      ref={scroll}
      role="region"
      aria-label={t('Redis 终端')}
      hidden={!visible}
      onClick={(event) => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !event.currentTarget.contains(selection.anchorNode)) input.current?.focus()
      }}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: 'var(--workspace-inset)',
        cursor: 'text',
        lineHeight: 1.65,
        userSelect: 'text',
        background: themeMode === 'dark' ? token.colorBgLayout : token.colorBgContainer
      }}
    >
      <div role="log" aria-label={t('命令输出')}>
        {entries.map((entry) => (
          <div key={entry.index} style={{ marginBottom: token.marginXS, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            <div>
              <span style={{ color: token.colorWarningText }}>{entry.prompt}</span> {entry.command}
            </div>
            {entry.command.trim() && (
              <div style={{ color: entry.error ? token.colorErrorText : token.colorText }}>
                {entry.answer === undefined ? <LoadingOutlined spin aria-label={t('执行中')} /> : entry.error ? t('执行失败') : entry.answer || '""'}
              </div>
            )}
            {entry.truncated && <div style={{ color: token.colorTextSecondary }}>{t('仅显示部分内容')}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: token.marginXS, width: '100%' }}>
        <span aria-hidden="true" style={{ color: token.colorWarningText }}>
          {prompt}
        </span>
        <ConsoleInput
          value={command}
          initialSelection={initial.selection}
          themeMode={themeMode}
          disabled={pending || blocked}
          onChange={(value) => {
            cursor.current = null
            setCommand(value)
          }}
          onSelectionChange={(next) => setSelection((previous) => (previous.anchor === next.anchor && previous.head === next.head ? previous : next))}
          onExecute={() => void execute()}
          onRecall={recall}
          onClear={() => setEntries([])}
          onViewChange={(view) => {
            input.current = view
            if (visible) view?.focus()
          }}
        />
      </div>
      {hints.length > 0 && (
        <div aria-label={t('命令用法')} style={{ color: token.colorTextSecondary, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {hints.join(' · ')}
        </div>
      )}
    </div>
  )
}
