import type { ButtonProps, ModalProps, TableProps, TabsProps } from 'antd'

export const ComponentSize = { Small: 'small', Middle: 'middle', Large: 'large' } as const
export type ComponentSize = (typeof ComponentSize)[keyof typeof ComponentSize]

/** 所有弹窗（含 AntApp 的确认弹窗）共享主题外框。 */
export const modalStyles = { container: { border: '1px solid var(--ant-color-border)' } } satisfies NonNullable<ModalProps['styles']>

/** 仅集中已确认的界面约定，其余视觉属性沿用 Ant Design 默认值。 */
export const appearance = {
  controlSize: ComponentSize.Middle,
  tableSize: ComponentSize.Small,
  navigationSize: ComponentSize.Small,
  selectWidth: 220,
  borderRadius: 0
} as const satisfies {
  controlSize: NonNullable<ButtonProps['size']>
  tableSize: NonNullable<TableProps['size']>
  navigationSize: NonNullable<TabsProps['size']>
  selectWidth: number
  borderRadius: number
}
