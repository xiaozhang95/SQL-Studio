import { useSyncExternalStore } from 'react'

const routes = { workspace: '/', agent: '/agent', monitor: '/monitor', sync: '/sync' } as const
const navigationEvent = 'sql-studio:navigation'
type Section = keyof typeof routes
export type DatabaseSection = Extract<Section, 'monitor' | 'sync'>
export type DatabaseSectionScope = { connectionId: string; database?: string }

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener)
  window.addEventListener(navigationEvent, listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(navigationEvent, listener)
  }
}

function navigate(section: Section, scope?: DatabaseSectionScope) {
  const url = new URL(window.location.href)
  url.pathname = routes[section]
  if (scope?.connectionId) url.searchParams.set('connection', scope.connectionId)
  else url.searchParams.delete('connection')
  if (scope?.connectionId && scope.database) url.searchParams.set('database', scope.database)
  else url.searchParams.delete('database')
  url.hash = ''
  if (url.href === window.location.href) return
  window.history.pushState(null, '', url.href)
  // pushState does not emit popstate; notify React without reloading the document.
  window.dispatchEvent(new Event(navigationEvent))
}

const readLocation = () => window.location.href

export function useAppSection() {
  const url = new URL(useSyncExternalStore(subscribe, readLocation))
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  const section = (Object.keys(routes) as Section[]).find((name) => routes[name] === pathname) ?? 'workspace'
  return {
    section,
    connectionId: url.searchParams.get('connection') ?? '',
    database: url.searchParams.get('database') ?? '',
    openAgent: () => navigate('agent'),
    openWorkspace: () => navigate('workspace'),
    openDatabaseSection: (name: DatabaseSection, scope?: DatabaseSectionScope) => navigate(name, scope)
  }
}
