import { Card, Flex, Progress, Statistic, Tabs, Tag, theme, Typography } from 'antd'

import type { DatabaseMonitorPanelProps } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'

import StatusInfo from './components/statusInfo'
import TrendChart from './components/trendChart'
import { activityMetrics, overviewMetrics, trendCharts } from './constant'
import { formatMetric, metricValue } from './utils'

export default function RedisMonitor({ snapshot, history }: DatabaseMonitorPanelProps) {
  const { t, language } = useTranslation()
  const { token } = theme.useToken()
  const detail = snapshot.redis
  const used = Number(metricValue(snapshot, 'redis_memory_bytes'))
  const maximum = Number(metricValue(snapshot, 'redis_memory_max_bytes'))
  const memoryPercent = Number.isFinite(used) && Number.isFinite(maximum) && maximum > 0 ? (used / maximum) * 100 : undefined
  const activity = (
    <Flex vertical gap="middle">
      <Typography.Text type="secondary">{t('趋势仅记录本页打开后的采样；可开启自动刷新连续观察。')}</Typography.Text>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: token.marginMD }}>
        {trendCharts.map((chart) => (
          <TrendChart key={chart.key} title={chart.title} series={chart.series} history={history} />
        ))}
      </div>
      <div className="database-monitor-metrics" style={{ display: 'grid', gap: token.marginMD }}>
        {activityMetrics.map((metric) => (
          <Card key={metric.key} size="small" style={{ minWidth: 0 }}>
            <Statistic
              title={t(metric.label)}
              value={metricValue(snapshot, metric.key) ?? '—'}
              formatter={() => formatMetric(metricValue(snapshot, metric.key), metric.format, language)}
              style={{ overflowWrap: 'anywhere' }}
            />
          </Card>
        ))}
      </div>
    </Flex>
  )
  return (
    <Flex vertical gap="middle">
      <Card
        size="small"
        title={t('实例概览')}
        extra={
          <Flex gap="small" wrap>
            {detail?.version && <Tag>{`v${detail.version}`}</Tag>}
            {detail?.mode && <Tag>{detail.mode}</Tag>}
            {detail?.role && <Tag>{detail.role}</Tag>}
          </Flex>
        }
      >
        <div className="database-monitor-metrics" style={{ display: 'grid', gap: token.marginLG }}>
          {overviewMetrics.map((metric) => (
            <Statistic
              key={metric.key}
              title={t(metric.label)}
              value={metricValue(snapshot, metric.key) ?? '—'}
              formatter={() => formatMetric(metricValue(snapshot, metric.key), metric.format, language)}
              style={{ minWidth: 0, overflowWrap: 'anywhere' }}
            />
          ))}
        </div>
        {memoryPercent !== undefined && (
          <Flex vertical gap="small" style={{ marginTop: token.marginMD }}>
            <Typography.Text type="secondary">
              {t('内存上限使用率')}: {formatMetric(String(memoryPercent), 'percent', language)} · {t('内存上限')}: {formatMetric(String(maximum), 'bytes', language)}
            </Typography.Text>
            <Progress percent={Math.min(100, memoryPercent)} showInfo={false} size="small" status={memoryPercent >= 100 ? 'exception' : 'normal'} />
          </Flex>
        )}
      </Card>
      <Tabs
        defaultActiveKey="activity"
        items={[
          { key: 'activity', label: t('活动状态'), children: activity },
          { key: 'info', label: t('状态信息'), children: <StatusInfo detail={detail} /> }
        ]}
      />
    </Flex>
  )
}
