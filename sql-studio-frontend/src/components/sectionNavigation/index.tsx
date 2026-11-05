import { DatabaseOutlined, RobotOutlined } from '@ant-design/icons'
import { Button } from 'antd'

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
  return (
    <div style={{ borderInlineStart: '1px solid var(--border)', paddingInlineStart: 'var(--workspace-inset)', flexShrink: 0 }}>
      <Button icon={<Icon />} disabled={switchDisabled} onClick={onSwitch}>
        {label}
      </Button>
    </div>
  )
}
