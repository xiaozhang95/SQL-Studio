import type { ButtonProps, ConfigProviderProps, ModalProps } from 'antd'

/** 仅集中已确认的界面约定，其余视觉属性沿用 Ant Design 默认值。 */
export const appearance = {
  controlSize: 'middle',
  selectWidth: 220,
  panelHeaderHeight: 42,
  railIconSize: 20
} as const satisfies {
  controlSize: NonNullable<ButtonProps['size']>
  selectWidth: number
  panelHeaderHeight: number
  railIconSize: number
}

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
  body: { padding: 0 },
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

export const railButtonStyle = {
  position: 'relative',
  width: 40,
  height: 40,
  padding: 0,
  borderRadius: 'var(--ant-border-radius)'
} as const satisfies NonNullable<ButtonProps['style']>
