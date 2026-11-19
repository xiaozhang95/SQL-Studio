import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'

import { PageErrorsContext } from '@/contexts/pageErrors'
import type { PageErrorReason } from '@/contexts/pageErrors'

export function PageErrorsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ReadonlyMap<string, PageErrorReason>>(() => new Map())
  const setError = useCallback((id: string, error?: PageErrorReason) => {
    setEntries((previous) => {
      if (previous.get(id) === error) return previous
      const next = new Map(previous)
      if (error) next.set(id, error)
      else next.delete(id)
      return next
    })
  }, [])
  const clearErrors = useCallback(() => setEntries((previous) => (previous.size ? new Map() : previous)), [])
  return <PageErrorsContext.Provider value={{ errors: [...entries.values()].flat(), setError, clearErrors }}>{children}</PageErrorsContext.Provider>
}
