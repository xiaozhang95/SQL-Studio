import { DatabaseOutlined, RobotOutlined } from '@ant-design/icons'
import { Button, theme } from 'antd'

interface Props {
  destination: 'workspace' | 'agent'
  onSwitch: () => void
  switchDisabled?: boolean
}

const destinations = {
  workspace: { label: '工作区', Icon: DatabaseOutlined },
  agent: { label: 'AI 助手', Icon: RobotOutlined }
} as const

export default function SectionNavigation({ destination, onSwitch, switchDisabled = false }: Props) {
  const { label, Icon } = destinations[destination]
  const { token } = theme.useToken()
  return (
    <div style={{ borderInlineStart: '1px solid var(--border)', marginInlineStart: token.marginXXS, paddingInlineStart: token.paddingXS, flexShrink: 0 }}>
      <Button type="text" icon={<Icon />} disabled={switchDisabled} onClick={onSwitch}>
        {label}
      </Button>
    </div>
  )
}
