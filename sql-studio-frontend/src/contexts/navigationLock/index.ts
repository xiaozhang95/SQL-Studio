import { createContext, useContext, useEffect } from 'react'

type NavigationLock = { locked: boolean; setLocked: (locked: boolean) => void }

export const NavigationLockContext = createContext<NavigationLock | null>(null)

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
