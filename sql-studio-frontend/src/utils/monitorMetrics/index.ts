import type { MonitorSnapshot } from '@/typings/database'
import type { MetricDefinition, MetricFormat } from '@/typings/databaseMonitor'

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
  if (format === 'countRate') return decimal.format(number) + '/s'
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(number / 100)
  if (format === 'date') return number > 0 ? new Date(number * 1000).toLocaleString(locale) : '—'
  if (format === 'microseconds') return `${decimal.format(number)} µs`
  return decimal.format(number)
}

export function isMonitorReset(previous: MonitorSnapshot | undefined, next: MonitorSnapshot): boolean {
  if (!previous) return false
  const before = previous.redis?.runId || previous.details?.identity
  const after = next.redis?.runId || next.details?.identity
  if (before && after && before !== after) return true
  const uptimeBefore = metricValue(previous, 'uptime'),
    uptimeAfter = metricValue(next, 'uptime')
  return uptimeBefore !== undefined && uptimeAfter !== undefined && Number(uptimeAfter) < Number(uptimeBefore)
}

/** Subtract integer counters before converting to chart coordinates. */
export function sampleValue(history: readonly MonitorSnapshot[], index: number, metric: Pick<MetricDefinition, 'key' | 'source'>): string | undefined {
  const current = history[index]
  if (!current) return undefined
  const value = metricValue(current, metric.key)
  if (metric.source !== 'counter') return value
  const previous = history[index - 1]
  if (!previous || isMonitorReset(previous, current)) return undefined
  const before = metricValue(previous, metric.key)
  if (value === undefined || value === '' || before === undefined || before === '') return undefined
  const elapsed = (Date.parse(current.sampledAt) - Date.parse(previous.sampledAt)) / 1000
  if (!Number.isFinite(elapsed) || elapsed <= 0) return undefined
  const delta = /^\d+$/.test(value) && /^\d+$/.test(before) ? Number(BigInt(value) - BigInt(before)) : Number(value) - Number(before)
  if (!Number.isFinite(delta) || delta < 0) return undefined
  return String(delta / elapsed)
}
