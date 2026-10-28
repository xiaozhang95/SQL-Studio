import type { ButtonProps, TableProps, TabsProps } from 'antd'

export const ComponentSize = { Small: 'small', Middle: 'middle', Large: 'large' } as const
export type ComponentSize = (typeof ComponentSize)[keyof typeof ComponentSize]

/** 仅集中已确认的界面约定，其余视觉属性沿用 Ant Design 默认值。 */
export const appearance = {
  controlSize: ComponentSize.Middle,
  tableSize: ComponentSize.Small,
  navigationSize: ComponentSize.Small,
  selectWidth: 220
} as const satisfies {
  controlSize: NonNullable<ButtonProps['size']>
  tableSize: NonNullable<TableProps['size']>
  navigationSize: NonNullable<TabsProps['size']>
  selectWidth: number
}
