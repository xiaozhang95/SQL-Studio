import { createContext, useContext, useId, useLayoutEffect } from 'react'

export type PageErrorReason = string | readonly string[]

export const PageErrorsContext = createContext<{
  errors: readonly string[]
  setError: (id: string, error?: PageErrorReason) => void
  clearErrors: () => void
} | null>(null)

export function usePageErrors() {
  return useContext(PageErrorsContext)
}

export function usePageError(error?: PageErrorReason, occurrence?: string | number) {
  const setError = usePageErrors()?.setError
  const id = `${useId()}:${occurrence ?? ''}`
  useLayoutEffect(() => {
    if (!setError || !error?.length) return
    setError(id, error)
    return () => setError(id)
  }, [id, error, setError])
}
