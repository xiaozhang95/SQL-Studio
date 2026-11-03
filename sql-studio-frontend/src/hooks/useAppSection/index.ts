import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}
export function useAppSection() {
  const agent = useSyncExternalStore(subscribe, () => window.location.hash === '#agent')
  return {
    agent,
    openAgent: () => {
      window.location.hash = 'agent'
    },
    openWorkspace: () => {
      window.location.hash = 'workspace'
    }
  }
}
