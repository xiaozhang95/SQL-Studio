import type { ButtonProps, ConfigProviderProps, ModalProps, SwitchProps } from 'antd'
import type { CSSProperties } from 'react'

/** 仅集中已确认的界面约定，其余视觉属性沿用 Ant Design 默认值。 */
export const appearance = {
  controlSize: 'middle',
  switchSize: 'small',
  selectWidth: 220,
  panelHeaderHeight: 42,
  railIconSize: 20
} as const satisfies {
  controlSize: NonNullable<ButtonProps['size']>
  switchSize: NonNullable<SwitchProps['size']>
  selectWidth: number
  panelHeaderHeight: number
  railIconSize: number
}

export const panelHeaderRowStyle = {
  boxSizing: 'border-box',
  minHeight: appearance.panelHeaderHeight,
  borderBlockEnd: 'var(--ant-line-width) solid var(--layout-divider)'
} as const satisfies CSSProperties

/** 原生 Modal 与 AntApp 确认弹窗的操作按钮统一使用 default。 */
export const modalDefaults = { okButtonProps: { type: 'default' } } as const satisfies NonNullable<ConfigProviderProps['modal']>

export const tagDefaults = { variant: 'solid' } as const satisfies NonNullable<ConfigProviderProps['tag']>

/** 含独立滚动内容区的表单弹窗共用边界、行高与内边距。 */
export const formModalStyles = {
  container: { padding: 0, overflow: 'hidden' },
  header: {
    margin: 0,
    minHeight: 52,
    paddingInline: 'var(--ant-padding)',
    display: 'flex',
    alignItems: 'center',
    borderBlockEnd: 'var(--ant-line-width) solid var(--ant-color-border-secondary)'
  },
  body: { padding: 0, height: 'clamp(280px, calc(100dvh - 240px), 532px)' },
  footer: {
    margin: 0,
    minHeight: 58,
    paddingBlock: 'var(--ant-padding-xs)',
    paddingInline: 'var(--ant-padding)',
    display: 'flex',
    alignItems: 'center',
    borderBlockStart: 'var(--ant-line-width) solid var(--ant-color-border-secondary)'
  }
} as const satisfies NonNullable<ModalProps['styles']>

export const scrollingModalBodyStyle = { maxHeight: 'max(160px, calc(100dvh - 240px))', overflowY: 'auto', overflowX: 'hidden' } as const satisfies CSSProperties

export const railButtonStyle = {
  position: 'relative',
  width: 40,
  height: 40,
  padding: 0,
  borderRadius: 'var(--ant-border-radius)'
} as const satisfies NonNullable<ButtonProps['style']>
