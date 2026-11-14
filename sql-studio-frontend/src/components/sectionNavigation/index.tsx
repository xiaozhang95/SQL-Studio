import { DashboardOutlined, DatabaseOutlined, RobotOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, theme } from 'antd'

import { useTranslation } from '@/hooks/useTranslation'

interface Props {
  destination: keyof typeof destinations
  onSwitch: () => void
  switchDisabled?: boolean
  separated?: boolean
}

const destinations = {
  workspace: { label: '工作区', Icon: DatabaseOutlined },
  agent: { label: 'AI 助手', Icon: RobotOutlined },
  monitor: { label: '监控指标', Icon: DashboardOutlined },
  sync: { label: '同步数据库', Icon: SwapOutlined }
} as const

export default function SectionNavigation({ destination, onSwitch, switchDisabled = false, separated = true }: Props) {
  const { t } = useTranslation()
  const { label, Icon } = destinations[destination]
  const { token } = theme.useToken()
  const button = (
    <Button type="text" icon={<Icon />} disabled={switchDisabled} onClick={onSwitch}>
      {t(label)}
    </Button>
  )
  return separated ? <div style={{ borderInlineStart: '1px solid var(--border)', marginInlineStart: token.marginXXS, paddingInlineStart: token.paddingXS, flexShrink: 0 }}>{button}</div> : button
}
