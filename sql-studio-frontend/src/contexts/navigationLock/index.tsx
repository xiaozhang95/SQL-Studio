import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type NavigationLock = { locked: boolean; setLocked: (locked: boolean) => void }

const NavigationLockContext = createContext<NavigationLock | null>(null)

/** 页面执行关键操作时阻止全局导航切走，完成或卸载后恢复。 */
export function NavigationLockProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false)
  const value = useMemo(() => ({ locked, setLocked }), [locked])
  return <NavigationLockContext.Provider value={value}>{children}</NavigationLockContext.Provider>
}

export function useNavigationLock() {
  const context = useContext(NavigationLockContext)
  if (!context) throw new Error('useNavigationLock must be used inside NavigationLockProvider')
  return context
}

/** 把页面的忙碌状态映射为导航锁，卸载时自动释放。 */
export function useNavigationLockEffect(locked: boolean) {
  const { setLocked } = useNavigationLock()
  useEffect(() => {
    if (!locked) return
    setLocked(true)
    return () => setLocked(false)
  }, [locked, setLocked])
}