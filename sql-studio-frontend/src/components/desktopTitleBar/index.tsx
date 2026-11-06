import { theme } from 'antd'
import { useEffect } from 'react'

import type { DesktopBridge } from '@/typings/desktop'

const desktop: DesktopBridge | undefined = window.sqlStudioDesktop

/** 与 PageHeader 共用主题背景，拖动区域与原生窗口按钮独立于业务控件。 */
export default function DesktopTitleBar({ showTitle = true, title = 'SQL Studio', active = true }: { showTitle?: boolean; title?: string; active?: boolean }) {
  const { token } = theme.useToken()
  useEffect(() => {
    desktop?.setTitleBarTheme({
      background: token.colorBgContainer,
      foreground: token.colorTextBase,
      mode: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    })
  }, [token.colorBgContainer, token.colorTextBase])
  useEffect(() => {
    // 工作台在 AI 页后台保留挂载；仅当前页面可更新系统窗口标题。
    if (desktop && active) document.title = showTitle ? title : 'SQL Studio'
  }, [active, showTitle, title])
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
      {showTitle && (
        <span title={title} style={{ maxWidth: 'calc(100% - 320px)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, lineHeight: `${desktop.titleBarHeight}px` }}>
          <img src="/studio.svg" alt="" width={16} height={16} draggable={false} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </span>
      )}
    </div>
  )
}
