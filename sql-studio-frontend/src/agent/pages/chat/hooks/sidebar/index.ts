import { sidebarLayout } from '@/constant/sidebarLayout'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { useSidebarWidth } from '@/hooks/useSidebarWidth'

export function useAgentSidebar() {
  const { width, setWidth } = useSidebarWidth()
  return useSidebarResize(width, setWidth, sidebarLayout)
}
