import { useEffect, useLayoutEffect, useRef } from 'react'

import type { DesktopBridge } from '@/typings/desktop'

type SaveState = { ready: boolean; saving: boolean; error?: string; blocked: boolean }
type Options = SaveState & { flush: () => void }

/** Wait for React to publish the flushed draft and for actual persistence to complete. */
export async function waitForDesktopSave(read: () => SaveState, flush: () => void, nextFrame: () => Promise<void>, timeout = 10000) {
  flush()
  await nextFrame()
  await nextFrame()
  const deadline = Date.now() + timeout
  while (true) {
    const state = read()
    if (state.error) throw new Error(state.error)
    if (!state.ready) throw new Error('工作区尚未完成读取，请稍后再退出。')
    if (state.blocked) throw new Error('还有正在进行的操作或未保存的表格修改，请完成、保存或放弃后再退出。')
    if (!state.saving) return
    if (Date.now() >= deadline) throw new Error('等待工作区保存超时，请检查本机配置保存状态。')
    await nextFrame()
  }
}

export function useDesktopLifecycle(options: Options) {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  useEffect(() => {
    const bridge: DesktopBridge | undefined = window.sqlStudioDesktop
    if (!bridge) return
    return bridge.onBeforeClose(() =>
      waitForDesktopSave(
        () => latest.current,
        () => latest.current.flush(),
        () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      )
    )
  }, [])
}
