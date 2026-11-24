import { theme } from 'antd'

type Props = {
  count: number
}

/** 面板标题旁的数量提示，统一键浏览和活跃频道的浅色小徽标。 */
export default function CountBadge({ count }: Props) {
  const { token } = theme.useToken()
  return (
    <span
      style={{
        paddingInline: 6,
        borderRadius: token.borderRadiusSM,
        background: token.colorFillSecondary,
        color: token.colorTextSecondary,
        fontSize: token.fontSizeSM,
        lineHeight: '18px'
      }}
    >
      {count}
    </span>
  )
}
