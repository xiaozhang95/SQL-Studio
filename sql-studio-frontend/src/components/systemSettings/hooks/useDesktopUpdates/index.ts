import { useEffect, useRef, useState } from 'react'

import type { DesktopUpdateStatus } from '@/typings/desktop'

type UpdateAction = 'check' | 'download' | 'openRelease' | 'install'

const actionErrors = {
  check: '检查更新失败，请确认可以访问 GitHub 后重试。',
  download: '下载更新失败，请重试或前往 GitHub 下载。',
  openRelease: '无法打开下载页面',
  install: '无法启动更新安装'
} as const satisfies Record<UpdateAction, string>

export function useDesktopUpdates() {
  const desktop = window.sqlStudioDesktop
  const [version, setVersion] = useState<string>(import.meta.env.VITE_SQL_STUDIO_VERSION)
  const [result, setResult] = useState<DesktopUpdateStatus>()
  const [pending, setPending] = useState<UpdateAction>()
  const [error, setError] = useState('')
  const running = useRef(false)

  useEffect(() => {
    if (!desktop) return
    let active = true
    void desktop.getVersion().then(
      (value) => {
        if (active) setVersion(value)
      },
      () => {} // The same release version is also embedded in the web build.
    )
    return () => {
      active = false
    }
  }, [desktop])

  async function run(action: UpdateAction) {
    if (!desktop || running.current) return
    running.current = true
    setPending(action)
    setError('')
    try {
      if (action === 'check' || action === 'download') setResult(await desktop.updates[action]())
      else await desktop.updates[action]()
    } catch {
      if (action === 'check') setResult(undefined)
      setError(actionErrors[action])
    } finally {
      setPending(undefined)
      running.current = false
    }
  }

  return { version, desktop: Boolean(desktop), result, pending, error, run }
}
