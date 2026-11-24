import type { CSSProperties } from 'react'

/** 工作区专属尺寸；两页共用的侧栏尺寸位于 constant/sidebarLayout。 */
export const resultPanelLayout = { defaultHeight: 260, minimumHeight: 260, editorReservedHeight: 280, keyboardStep: 24 } as const

export const resultSQLLayout = { columnWidth: 520 } as const
export const resultTableLayout = { indexWidth: 64, columnWidth: 200, selectionWidth: 32 } as const
export const resultTabLayout = { maximumVisibleTabs: 8 } as const
/** 默认图标按钮从点击边界到居中图标的水平留白。 */
export const resultToolbarIconInset = 'calc((var(--ant-control-height) - var(--ant-font-size)) / 2)'
export const workspaceTabLayout = { width: 200 } as const

/** 主页面与结果页签共用栏尺寸，分隔线由 Ant Design Tabs 绘制。 */
export const workspaceTabBarStyle = {
  height: 38,
  margin: 0,
  paddingInline: 'var(--workspace-inset)',
  background: 'var(--surface)'
} as const satisfies CSSProperties
export const sqlCompletionLayout = { width: 360, height: 256 } as const
export const scopeCloseDialogLayout = { width: 560 } as const
export const objectTreeLayout = { rowHeight: 30, switcherWidth: 20, scrollSaveDelay: 150 } as const
/** Redis 键浏览/发布订阅双栏共用的侧栏宽度和标题栏高度。 */
export const redisPanelLayout = { sidebarWidth: 320, headerHeight: 42 } as const

export const workspaceEmptyStyle = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: 32,
  textAlign: 'center'
} as const satisfies CSSProperties
