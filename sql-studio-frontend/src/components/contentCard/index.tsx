import { Card, type CardProps } from 'antd'

export interface ContentCardProps extends Omit<CardProps, 'size' | 'styles'> {
  code?: boolean
}
/** 内容与代码卡片共用外框，布局通过 Card 的原生样式 API 提供。 */
export default function ContentCard({ code = false, style, ...props }: ContentCardProps) {
  return (
    <Card
      {...props}
      size="small"
      style={{
        width: '100%',
        minWidth: 0,
        boxShadow: 'var(--card-shadow)',
        ...(code ? { overflow: 'hidden' } : {}),
        ...style
      }}
      styles={code ? { body: { padding: 0 }, header: { marginBottom: 0 } } : undefined}
    />
  )
}
