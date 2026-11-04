import { useState } from 'react'

import { useSidebarResize } from '@/hooks/useSidebarResize'

import { CHAT } from '../../constant/chat'

export function useAgentSidebar() {
  const [width, setWidth] = useState<number>(CHAT.sidebarLayout.defaultWidth)
  return useSidebarResize(width, setWidth, CHAT.sidebarLayout)
}
