import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { sidebarLayout } from '@/constant/sidebarLayout'
import { SidebarWidthContext } from '@/hooks/useSidebarWidth'

function validWidth(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(sidebarLayout.minimumWidth, Math.min(value, sidebarLayout.maximumWidth)) : sidebarLayout.defaultWidth
}

/** App owns one preference; the mounted workspace persists it through its existing layout index. */
export default function SidebarWidthProvider({ children }: { children: ReactNode }) {
  const [width, updateWidth] = useState<number>(sidebarLayout.defaultWidth)
  const changed = useRef(false)
  const setWidth = useCallback((value: number) => {
    changed.current = true
    updateWidth(validWidth(value))
  }, [])
  const restoreWidth = useCallback((value: unknown) => {
    // A delayed initial read must not overwrite a width already adjusted in Agent.
    if (!changed.current) updateWidth(validWidth(value))
  }, [])
  const controller = useMemo(() => ({ width, setWidth, restoreWidth }), [width, setWidth, restoreWidth])
  return <SidebarWidthContext.Provider value={controller}>{children}</SidebarWidthContext.Provider>
}
