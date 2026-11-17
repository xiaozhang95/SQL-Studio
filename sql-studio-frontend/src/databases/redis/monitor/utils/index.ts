import { formatMetric } from '@/utils/monitorMetrics'

import { infoFields } from '../constant'

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
