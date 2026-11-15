import type { WorkspaceTab } from '@/typings/workspace'

type Page = Pick<WorkspaceTab, 'id' | 'kind' | 'connectionId' | 'database'>
type Selection = { page: string; connection: string; database: string; previous: string[] }

const storageKey = 'sql-studio:pending-redis-databases'
const isDatabase = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value))

export function rememberRedisDatabases(current: readonly Page[], saved: readonly Page[], inFlight: readonly Page[], connections: ReadonlySet<string>) {
  const savedPages = new Map(saved.map((page) => [page.id, page]))
  const pendingPages = new Map(inFlight.map((page) => [page.id, page]))
  const selections: Selection[] = []
  for (const page of current) {
    const baseline = savedPages.get(page.id)
    if (page.kind !== 'query' || !connections.has(page.connectionId) || !isDatabase(page.database) || baseline?.kind !== 'query' || baseline.connectionId !== page.connectionId) continue
    const pending = pendingPages.get(page.id)
    const previous = new Set([baseline.database])
    if (pending?.kind === 'query' && pending.connectionId === page.connectionId) previous.add(pending.database)
    previous.delete(page.database)
    if (previous.size) selections.push({ page: page.id, connection: page.connectionId, database: page.database, previous: [...previous] })
  }
  if (!selections.length) {
    clearRedisDatabaseSession()
    return
  }
  try {
    const encoded = JSON.stringify(selections)
    if (sessionStorage.getItem(storageKey) !== encoded) sessionStorage.setItem(storageKey, encoded)
  } catch {
    // The regular workspace save still runs.
  }
}

export function restoreRedisDatabases(tabs: WorkspaceTab[]): WorkspaceTab[] {
  try {
    const encoded = sessionStorage.getItem(storageKey)
    if (!encoded) return tabs
    const stored: unknown = JSON.parse(encoded)
    if (!Array.isArray(stored)) return tabs
    const selections = new Map<string, Selection>()
    for (const entry of stored) {
      if (!entry || typeof entry.page !== 'string' || typeof entry.connection !== 'string' || !isDatabase(entry.database) || !Array.isArray(entry.previous)) continue
      selections.set(entry.page, entry)
    }
    return tabs.map((tab) => {
      const selection = selections.get(tab.id)
      return tab.kind === 'query' && selection?.connection === tab.connectionId && selection.previous.includes(tab.database) ? { ...tab, database: selection.database } : tab
    })
  } catch {
    return tabs
  }
}

export function clearRedisDatabaseSession() {
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // Browser session storage may be unavailable.
  }
}
