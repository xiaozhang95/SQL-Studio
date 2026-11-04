import { createContext, useContext } from 'react'

interface SidebarWidthController {
  width: number
  setWidth: (width: number) => void
  restoreWidth: (width: unknown) => void
}

export const SidebarWidthContext = createContext<SidebarWidthController | null>(null)

export function useSidebarWidth(): SidebarWidthController {
  const controller = useContext(SidebarWidthContext)
  if (!controller) throw new Error('侧栏宽度需要 SidebarWidthProvider')
  return controller
}
