import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { NavigationLockContext } from '@/contexts/navigationLock'

export default function NavigationLockProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false)
  const value = useMemo(() => ({ locked, setLocked }), [locked])
  return <NavigationLockContext.Provider value={value}>{children}</NavigationLockContext.Provider>
}
