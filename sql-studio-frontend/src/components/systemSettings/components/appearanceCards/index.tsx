import { Radio, theme } from 'antd'
import type { RadioProps } from 'antd'
import type { ReactNode } from 'react'

import { settingsLayout } from '../../constant/settings'

interface Props<T extends string> {
  label: string
  value: T
  onChange: (value: T) => void
  disabled: boolean
  options: readonly { value: T; label: string; preview: ReactNode }[]
}

/** Radio 的整张标签作为选项卡片，保留原生单选与键盘交互。 */
export default function AppearanceCards<T extends string>({ label, value, onChange, disabled, options }: Props<T>) {
  const { token } = theme.useToken()
  return (
    <Radio.Group
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value)
        if (selected) onChange(selected.value)
      }}
      style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${settingsLayout.cardMinWidth}px), 1fr))`, gap: token.marginSM }}
    >
      {options.map((option) => {
        const styles = {
          root: {
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            alignItems: 'center',
            gap: token.marginXS,
            margin: 0,
            padding: token.paddingSM,
            minWidth: 0,
            borderRadius: token.borderRadiusLG,
            boxShadow: 'var(--card-shadow), var(--appearance-card-shadow, 0 0 0 0 transparent)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: `transform ${token.motionDurationMid} ${token.motionEaseInOut}, box-shadow ${token.motionDurationMid} ${token.motionEaseInOut}`,
            background: token.colorBgContainer
          },
          icon: { gridColumn: 1, gridRow: 2 },
          label: { display: 'contents' }
        } satisfies RadioProps['styles']
        return (
          <Radio key={option.value} value={option.value} classNames={{ root: 'appearance-option-card' }} styles={styles}>
            <div aria-hidden="true" style={{ gridColumn: '1 / -1', gridRow: 1, minWidth: 0, marginBottom: token.marginXS }}>
              {option.preview}
            </div>
            <span style={{ gridColumn: 2, gridRow: 2 }}>{option.label}</span>
          </Radio>
        )
      })}
    </Radio.Group>
  )
}
