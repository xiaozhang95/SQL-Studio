import { useSyncExternalStore } from 'react'

const routes = { workspace: '/', agent: '/agent' } as const
const navigationEvent = 'sql-studio:navigation'

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener)
  window.addEventListener(navigationEvent, listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(navigationEvent, listener)
  }
}

function navigate(pathname: (typeof routes)[keyof typeof routes]) {
  if (window.location.pathname === pathname && !window.location.hash) return
  const url = new URL(window.location.href)
  url.pathname = pathname
  url.hash = ''
  window.history.pushState(null, '', url.href)
  // pushState does not emit popstate; notify React without reloading the document.
  window.dispatchEvent(new Event(navigationEvent))
}

const isAgent = () => window.location.pathname.replace(/\/+$/, '') === routes.agent

export function useAppSection() {
  const agent = useSyncExternalStore(subscribe, isAgent)
  return {
    agent,
    openAgent: () => navigate(routes.agent),
    openWorkspace: () => navigate(routes.workspace)
  }
}
