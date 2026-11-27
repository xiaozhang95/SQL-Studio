import type { CSSProperties } from 'react'

import { appearance } from '@/constant/appearance'

/** 工作区专属尺寸；两页共用的侧栏尺寸位于 constant/sidebarLayout。 */
export const resultPanelLayout = { defaultHeight: 260, minimumHeight: 260, editorReservedHeight: 280, keyboardStep: 24 } as const

export const resultSQLLayout = { columnWidth: 520 } as const
export const resultTableLayout = { indexWidth: 64, columnWidth: 200, selectionWidth: 32, minColumnWidth: 80 } as const
export const resultTabLayout = { maximumVisibleTabs: 8, wrapBasis: 260 } as const
export const resultControlProps = {
  size: appearance.controlSize,
  style: { width: appearance.selectWidth, maxWidth: '100%', minWidth: 0 } satisfies CSSProperties
} as const
export const workspaceConnectionIconSize = 20
export const queryScopeLayout = { width: 240, minWidth: 144 } as const
/** 默认图标按钮从点击边界到居中图标的水平留白。 */
export const resultToolbarIconInset = 'calc((var(--ant-control-height) - var(--ant-font-size)) / 2)'
export const workspaceTabLayout = { width: 200, menuWidth: 336, menuListHeight: 320 } as const

export const workspaceInset = 'var(--workspace-inset)'
export const workspaceTabBarSpacer = { display: 'block', width: workspaceInset } as const satisfies CSSProperties
export const resultToolbarSpacing = {
  paddingBlock: 'var(--ant-padding-xxs)',
  gap: 'var(--ant-margin-xs)'
} as const satisfies CSSProperties
export const resultNavigationContentHeight = `calc(${appearance.panelHeaderHeight}px - var(--ant-line-width))`

/** 主页面签栏的高度包含 Ant Design 绘制在栏内的分隔线。 */
export const workspaceTabBarStyle = {
  height: appearance.panelHeaderHeight,
  margin: 0,
  background: 'var(--surface)'
} as const satisfies CSSProperties
export const sqlCompletionLayout = { width: 360, height: 256 } as const
export const connectionFormLabelWidth = { 'zh-CN': '7.5em', 'en-US': 'clamp(7.5em, 36%, 10.5em)' } as const
export const scopeCloseDialogLayout = { width: 560 } as const
export const objectTreeLayout = { rowHeight: 30, switcherWidth: 20, scrollSaveDelay: 150 } as const
/** Redis 键浏览与发布订阅的双栏宽度。 */
export const redisPanelLayout = { sidebarWidth: 320 } as const

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
