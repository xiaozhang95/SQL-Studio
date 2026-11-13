import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, TimePicker } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useState } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

type Props = {
  value?: string
  onChange?: (value: string) => void
  fieldType?: string
  disabled?: boolean
  placeholder?: string
  label?: string
  autoFocus?: boolean
  multiline?: boolean
}

/** One editable value; the suffix button opens an anchored calendar/time panel. */
export default function TemporalInput({ value = '', onChange, fieldType = '', disabled, placeholder, label, autoFocus, multiline }: Props) {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)
  const type = fieldType
    .trim()
    .toLowerCase()
    .replace(/\(\d+\)/g, '')
    .replace(/\s+/g, ' ')
  const kind =
    type === 'date' ? 'date' : type === 'time' || type === 'time without time zone' ? 'time' : ['datetime', 'timestamp', 'timestamp without time zone'].includes(type) ? 'datetime' : undefined
  const format = kind === 'date' ? 'YYYY-MM-DD' : kind === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DD HH:mm:ss'
  const parsed = dayjs(kind === 'time' ? `2000-01-01 ${value}` : value)
  const selected = parsed.isValid() && parsed.format(format) === value ? parsed : null
  const popupContainer = (trigger: HTMLElement) => trigger.parentElement ?? trigger
  const changed = (date: Dayjs | null) => {
    if (date) onChange?.(date.format(format))
  }
  const common = {
    disabled,
    value,
    placeholder,
    autoFocus,
    'aria-label': label ?? t('字段值'),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange?.(event.target.value)
  }
  if (!kind) return multiline ? <Input.TextArea {...common} autoSize={{ minRows: 1, maxRows: 6 }} /> : <Input {...common} />
  const picker = {
    disabled,
    value: selected,
    open: open && !disabled,
    onOpenChange: setOpen,
    onChange: changed,
    format,
    getPopupContainer: popupContainer,
    allowClear: false,
    inputReadOnly: true,
    tabIndex: -1,
    style: { position: 'absolute' as const, inset: 0, width: '100%', opacity: 0, pointerEvents: 'none' as const }
  }
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Input
        {...common}
        suffix={
          <Button
            type="text"
            size="small"
            disabled={disabled}
            aria-label={kind === 'time' ? t('选择时间') : t('选择日期和时间')}
            aria-expanded={open && !disabled}
            icon={kind === 'time' ? <ClockCircleOutlined /> : <CalendarOutlined />}
            onClick={() => setOpen(!open)}
          />
        }
      />
      {kind === 'time' ? <TimePicker {...picker} /> : <DatePicker<Dayjs> {...picker} showTime={kind === 'datetime'} />}
    </div>
  )
}
