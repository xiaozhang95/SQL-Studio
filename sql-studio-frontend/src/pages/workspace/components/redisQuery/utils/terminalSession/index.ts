export const terminalHistoryLimit = 50
export const terminalCommandLimit = 64 * 1024

type Entry = { index: number; prompt: string; command: string; answer?: string; error?: boolean; truncated?: boolean }
export type TerminalSelection = Readonly<{ anchor: number; head: number }>
type Session = { command: string; selection: TerminalSelection; history: string[]; entries: Entry[] }
export type RedisTool = 'editor' | 'console' | 'pubsub' | 'keys'

const prefix = 'sql-studio:redis-terminal:'
const storageKey = (page: string, connection = '') => prefix + encodeURIComponent(page) + ':' + connection

export function readRedisTool(page: string): RedisTool {
  try {
    const tool = sessionStorage.getItem(storageKey(page))
    if (tool === 'console' || tool === 'pubsub' || tool === 'keys') return tool
  } catch {
    // Browser storage can be disabled.
  }
  return 'editor'
}

export function saveRedisTool(page: string, tool: RedisTool) {
  try {
    sessionStorage.setItem(storageKey(page), tool)
  } catch {
    // Browser storage can be disabled.
  }
}

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'index' in value &&
    Number.isSafeInteger(value.index) &&
    'prompt' in value &&
    typeof value.prompt === 'string' &&
    'command' in value &&
    typeof value.command === 'string' &&
    value.command.length <= terminalCommandLimit &&
    'answer' in value &&
    typeof value.answer === 'string'
  )
}

function readSelection(value: unknown, length: number): TerminalSelection {
  if (
    typeof value === 'object' &&
    value !== null &&
    'anchor' in value &&
    typeof value.anchor === 'number' &&
    Number.isSafeInteger(value.anchor) &&
    'head' in value &&
    typeof value.head === 'number' &&
    Number.isSafeInteger(value.head)
  ) {
    return { anchor: Math.max(0, Math.min(length, value.anchor)), head: Math.max(0, Math.min(length, value.head)) }
  }
  return { anchor: length, head: length }
}

export function readTerminal(page: string, connection: string): Session {
  try {
    const encoded = sessionStorage.getItem(storageKey(page, connection))
    if (encoded && encoded.length <= 3 * 1024 * 1024) {
      const { command, selection, history, entries } = JSON.parse(encoded)
      const draft = typeof command === 'string' ? command.replace(/[\r\n]/g, '').slice(0, terminalCommandLimit) : ''
      return {
        command: draft,
        selection: readSelection(selection, draft.length),
        history: Array.isArray(history) ? history.filter((value): value is string => typeof value === 'string' && value.length <= terminalCommandLimit).slice(-terminalHistoryLimit) : [],
        entries: Array.isArray(entries) ? entries.filter(isEntry).slice(-terminalHistoryLimit) : []
      }
    }
  } catch {
    // The terminal still works if browser storage is unavailable.
  }
  return { command: '', selection: { anchor: 0, head: 0 }, history: [], entries: [] }
}

export function saveTerminal(page: string, connection: string, session: Session) {
  try {
    const entries = session.entries.flatMap((entry) =>
      entry.answer === undefined ? [] : [{ ...entry, answer: entry.answer.slice(0, 4096), truncated: entry.truncated || entry.answer.length > 4096 }]
    )
    sessionStorage.setItem(storageKey(page, connection), JSON.stringify({ ...session, selection: readSelection(session.selection, session.command.length), entries }))
  } catch {
    // Browser storage can be disabled or at its quota.
  }
}

export function discardTerminal(page: string) {
  try {
    const prefix = storageKey(page)
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key)
    }
  } catch {
    // No stored state to remove.
  }
}
