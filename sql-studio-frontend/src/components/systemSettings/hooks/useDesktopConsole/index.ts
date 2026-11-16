import { useRef, useState } from 'react'

/** 控制台是即时桌面操作，与设置草稿和更新状态独立。 */
export function useDesktopConsole() {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  const running = useRef(false)

  async function openConsole() {
    const desktop = window.sqlStudioDesktop
    if (!desktop || running.current) return
    running.current = true
    setOpening(true)
    setError('')
    try {
      await desktop.openConsole()
    } catch {
      setError('无法打开控制台')
    } finally {
      running.current = false
      setOpening(false)
    }
  }

  return { opening, error, openConsole }
}
