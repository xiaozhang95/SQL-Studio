import Icon from '@ant-design/icons'

/** 中心圆与两侧声波表示发布订阅，尺寸和颜色跟随工具栏图标。 */
export default function PubSubIcon() {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <circle cx="12" cy="12" r="2" />
        <path d="M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
      </g>
    </Icon>
  )
}
