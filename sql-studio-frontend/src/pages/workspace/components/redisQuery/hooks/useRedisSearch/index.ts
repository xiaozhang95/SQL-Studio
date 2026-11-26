import { useEffect, useEffectEvent } from 'react'

const searchDelay = 250

export function useRedisSearch(filter: string, appliedPattern: string, enabled: boolean, onSearch: (pattern: string) => void) {
  const search = useEffectEvent((pattern: string) => {
    if (enabled && pattern === filter && pattern !== appliedPattern) onSearch(pattern)
  })

  useEffect(() => {
    if (!enabled || filter === appliedPattern) return
    const timer = setTimeout(() => search(filter), searchDelay)
    return () => clearTimeout(timer)
  }, [filter, appliedPattern, enabled])
}
