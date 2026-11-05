import { theme } from 'antd'
import { useEffect } from 'react'

import type { DesktopBridge } from '@/typings/desktop'

const desktop: DesktopBridge | undefined = window.sqlStudioDesktop

/** 与 PageHeader 共用主题背景，拖动区域与原生窗口按钮独立于业务控件。 */
export default function DesktopTitleBar() {
  const { token } = theme.useToken()
  useEffect(() => {
    desktop?.setTitleBarTheme({
      background: token.colorBgContainer,
      foreground: token.colorTextBase,
      mode: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    })
  }, [token.colorBgContainer, token.colorTextBase])
  if (!desktop) return null
  return (
    <div
      className="desktop-titlebar"
      style={{
        height: desktop.titleBarHeight,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface)',
        color: 'var(--text)',
        userSelect: 'none'
      }}
    >
      SQL Studio
    </div>
  )
}
