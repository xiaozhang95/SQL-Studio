import type { WorkspaceSnapshot } from '@/typings/workspace'

type WorkspaceTree = Pick<WorkspaceSnapshot, 'explorer' | 'openedConnections'>
type SavedTree = { revision: number; index: WorkspaceTree }
type TreeState = Pick<WorkspaceTree['explorer'], 'expanded' | 'selected'> & Pick<WorkspaceTree, 'openedConnections'>
const storageKey = 'sql-studio:pending-explorer'

function treeState({ explorer: { expanded, selected }, openedConnections }: WorkspaceTree): TreeState {
  return { expanded, selected, openedConnections }
}

export function rememberExplorer(current: WorkspaceTree, saved: SavedTree, inFlight: WorkspaceTree | null) {
  const draft = treeState(current)
  const baseline = treeState(saved.index)
  const pending = inFlight ? JSON.stringify(treeState(inFlight)) : undefined
  const encoded = JSON.stringify(draft)
  if (encoded === JSON.stringify(baseline) && (pending === undefined || pending === encoded)) {
    clearExplorerSession()
    return
  }
  try {
    const entry = JSON.stringify({ revision: saved.revision, pending, draft })
    if (sessionStorage.getItem(storageKey) !== entry) sessionStorage.setItem(storageKey, entry)
  } catch {
    // The workspace index still saves through the usual queue.
  }
}

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item: unknown) => typeof item === 'string')

export function restoreExplorer(saved: WorkspaceSnapshot, revision: number): WorkspaceSnapshot {
  try {
    const entry = sessionStorage.getItem(storageKey)
    if (!entry) return saved
    const { revision: baseline, pending, draft } = JSON.parse(entry)
    if (revision !== baseline && !(typeof baseline === 'number' && revision === baseline + 1 && pending === JSON.stringify(treeState(saved)))) return saved
    if (!draft || !strings(draft.expanded) || !strings(draft.selected) || !strings(draft.openedConnections)) return saved
    return { ...saved, explorer: { ...saved.explorer, expanded: draft.expanded, selected: draft.selected }, openedConnections: draft.openedConnections }
  } catch {
    return saved
  }
}

export function clearExplorerSession() {
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // Browser session storage may be unavailable.
  }
}
