import { CheckOutlined } from '@ant-design/icons'
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
        const selected = option.value === value
        const styles = {
          root: {
            position: 'relative',
            display: 'block',
            margin: 0,
            padding: token.paddingSM,
            minWidth: 0,
            border: `1px solid ${selected ? 'var(--primary)' : token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            boxShadow: selected ? '0 0 0 3px var(--primary-soft)' : undefined,
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: selected ? 'var(--primary-soft)' : token.colorBgContainer
          },
          icon: { position: 'absolute', top: 0, right: 0, width: 1, height: 1, opacity: 0 },
          label: { display: 'block', marginTop: token.marginXS, textAlign: 'center' as const }
        } satisfies RadioProps['styles']
        return (
          <Radio key={option.value} value={option.value} classNames={{ root: 'appearance-option-card' }} styles={styles}>
            <span className="appearance-option-check" aria-hidden="true">
              {selected && <CheckOutlined />}
            </span>
            <div aria-hidden="true" style={{ minWidth: 0 }}>
              {option.preview}
            </div>
            <span>{option.label}</span>
          </Radio>
        )
      })}
    </Radio.Group>
  )
}
