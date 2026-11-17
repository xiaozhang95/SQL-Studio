import type { MonitorSnapshot } from '@/typings/database'

import { infoFields } from '../constant'
import type { MetricFormat } from '../constant'

export function metricValue(snapshot: MonitorSnapshot | undefined, key: string) {
  return snapshot?.metrics.find((metric) => metric.key === key)?.value
}

/** 卡片保留整数精度，图表坐标仅使用有限的近似值。 */
export function formatMetric(value: string | undefined, format: MetricFormat, locale: string): string {
  if (value === undefined || value === '') return '—'
  if (format === 'text' || format === 'flag') return value
  if (format === 'count' && /^\d+$/.test(value)) return new Intl.NumberFormat(locale).format(BigInt(value))
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  if (format === 'bytes' || format === 'rate') {
    if (number < 0) return '—'
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    const index = number === 0 ? 0 : Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(number) / Math.log(1024))))
    return `${decimal.format(number / 1024 ** index)} ${units[index]}${format === 'rate' ? '/s' : ''}`
  }
  if (format === 'seconds' || format === 'milliseconds') {
    const seconds = format === 'milliseconds' ? number / 1000 : number
    if (seconds < 0) return '—'
    const unit = seconds >= 86400 ? 'day' : seconds >= 3600 ? 'hour' : seconds >= 60 ? 'minute' : 'second'
    const divisor = { day: 86400, hour: 3600, minute: 60, second: 1 }[unit]
    return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 2 }).format(seconds / divisor)
  }
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(number / 100)
  if (format === 'date') return number > 0 ? new Date(number * 1000).toLocaleString(locale) : '—'
  if (format === 'microseconds') return `${decimal.format(number)} µs`
  return decimal.format(number)
}

export function formatInfoField(key: string, value: string, locale: string, t: (message: string) => string) {
  const definition = key in infoFields ? infoFields[key as keyof typeof infoFields] : undefined
  if (key === 'maxmemory' && value === '0') return t('不限制')
  if (key === 'instantaneous_input_kbps' || key === 'instantaneous_output_kbps') return formatMetric(String(Number(value) * 1024), 'rate', locale)
  if (definition?.format === 'flag') return value === '1' ? t('是') : value === '0' ? t('否') : value
  if (value === 'ok') return t('正常')
  if (value === 'err') return t('失败')
  if (key === 'master_link_status') return value === 'up' ? t('已连接') : value === 'down' ? t('已断开') : value
  return formatMetric(value, definition?.format ?? 'text', locale)
}
