import { ClockCircleOutlined, DashboardOutlined, DatabaseOutlined, FieldTimeOutlined, HddOutlined, KeyOutlined, LineChartOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Alert, Card, Descriptions, Empty, Flex, Grid, Progress, Statistic, Tabs, Tag, theme, Typography } from 'antd'
import type { ReactNode } from 'react'

import type { DatabaseMonitorPanelProps } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { MetricDefinition, MonitorPanelConfig } from '@/typings/databaseMonitor'
import { formatMetric, metricValue, sampleValue } from '@/utils/monitorMetrics'

import TrendChart from '../monitorTrendChart'

type Props = DatabaseMonitorPanelProps & { config: MonitorPanelConfig }

const metricIcons: Record<string, ReactNode> = {
  uptime: <ClockCircleOutlined />,
  connections: <TeamOutlined />,
  running_threads: <ThunderboltOutlined />,
  active_sessions: <TeamOutlined />,
  queries: <LineChartOutlined />,
  slow_queries: <FieldTimeOutlined />,
  cache_hit_percent: <DashboardOutlined />,
  size_bytes: <DatabaseOutlined />,
  redis_keys: <KeyOutlined />,
  redis_memory_bytes: <DatabaseOutlined />
}

/** Common layout; field definitions and sampling semantics remain engine-owned. */
export default function MonitorPanel({ snapshot, history, config }: Props) {
  const { t, language } = useTranslation()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const columns = screens.xl ? 4 : 2
  const detail = snapshot.details
  const samples = history.at(-1) === snapshot ? history : [...history, snapshot]
  const value = (metric: MetricDefinition) => sampleValue(samples, samples.length - 1, metric)
  const changeOf = (metric: MetricDefinition) => {
    if (samples.length < 2) return undefined
    const before = Number(sampleValue(samples, samples.length - 2, metric))
    const after = Number(value(metric))
    if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) return undefined
    return ((after - before) / Math.abs(before)) * 100
  }
  const statistic = (metric: MetricDefinition, showChange = false) => {
    const change = showChange ? changeOf(metric) : undefined
    return (
      <div key={`${metric.key}:${metric.source ?? 'value'}`} style={{ minWidth: 0 }}>
        <Statistic
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {metricIcons[metric.key] ?? <DashboardOutlined />}
              {t(metric.label)}
            </span>
          }
          value={value(metric) ?? '—'}
          formatter={() => formatMetric(value(metric), metric.format, language)}
          valueStyle={{ fontWeight: token.fontWeightStrong, fontVariantNumeric: 'tabular-nums' }}
          style={{ minWidth: 0, overflowWrap: 'anywhere' }}
        />
        {change !== undefined && Math.abs(change) >= 0.05 && (
          <div style={{ marginTop: 2, color: token.colorTextSecondary, fontVariantNumeric: 'tabular-nums' }}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%<span style={{ marginInlineStart: 4, color: token.colorTextTertiary }}>{t('较上次')}</span>
          </div>
        )}
      </div>
    )
  }
  const used = config.capacity ? Number(metricValue(snapshot, config.capacity.used)) : NaN
  const limit = config.capacity ? Number(metricValue(snapshot, config.capacity.limit)) : NaN
  const percent = Number.isFinite(used) && Number.isFinite(limit) && limit > 0 ? (used / limit) * 100 : undefined
  const sections = detail?.sections.filter((section) => section.fields.length > 0) ?? [{ key: 'statistics', fields: snapshot.metrics }]
  const formatField = (key: string, raw: string) => {
    const field = config.fields[key]
    if (field?.format === 'flag') {
      const flag = raw.toLowerCase()
      return ['1', 'on', 'true'].includes(flag) ? t('是') : ['0', 'off', 'false'].includes(flag) ? t('否') : raw
    }
    return formatMetric(raw, field?.format ?? 'text', language)
  }
  return (
    <Flex vertical gap="middle">
      {detail?.warnings?.map((warning) => (
        <Alert key={warning} type="warning" showIcon title={t(warning)} />
      ))}
      <Card
        size="small"
        title={t(config.title)}
        extra={
          <Flex gap="small" wrap>
            {detail?.version && <Tag>{`v${detail.version}`}</Tag>}
            {detail?.role && <Tag color="success">{t(config.roleLabels?.[detail.role] ?? detail.role)}</Tag>}
          </Flex>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(columns, config.overview.length))}, minmax(0, 1fr))`, gap: token.marginLG }}>
          {config.overview.map((metric) => statistic(metric, true))}
        </div>
        {config.capacity && percent !== undefined && (
          <Flex vertical gap={6} style={{ marginTop: token.marginMD }}>
            <Flex justify="space-between" align="center" gap={8} wrap>
              <Typography.Text type="secondary">
                <HddOutlined style={{ marginInlineEnd: 6 }} />
                {t(config.capacity.label)}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMetric(String(used), 'count', language)} / {formatMetric(String(limit), 'count', language)} · {formatMetric(String(percent), 'percent', language)}
              </Typography.Text>
            </Flex>
            <Progress percent={Math.min(100, percent)} showInfo={false} strokeWidth={6} status={percent >= 100 ? 'exception' : 'normal'} />
          </Flex>
        )}
      </Card>
      <Tabs
        styles={{ header: { height: 38, margin: '0 0 16px' }, item: { height: 30, alignSelf: 'center', padding: '0 8px' } }}
        defaultActiveKey="activity"
        items={[
          {
            key: 'activity',
            label: t('活动状态'),
            children: (
              <Flex vertical gap="middle" style={{ paddingTop: 2 }}>
                <Typography.Text type="secondary">{t('趋势仅记录本页打开后的采样；可开启自动刷新连续观察。')}</Typography.Text>
                {config.notice && <Typography.Text type="secondary">{t(config.notice)}</Typography.Text>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: token.marginMD }}>
                  {config.charts.map((chart) => (
                    <TrendChart key={chart.key} title={chart.title} series={chart.series} history={samples} />
                  ))}
                </div>
                <div className="database-monitor-metrics" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: token.marginMD }}>
                  {config.activity.map((metric) => (
                    <Card key={`${metric.key}:${metric.source ?? 'value'}`} size="small" style={{ minWidth: 0 }}>
                      {statistic(metric)}
                    </Card>
                  ))}
                </div>
              </Flex>
            )
          },
          {
            key: 'info',
            label: t('状态信息'),
            children: (
              <Flex vertical gap="middle">
                {config.notice && <Typography.Text type="secondary">{t(config.notice)}</Typography.Text>}
                <div style={{ display: 'grid', gridTemplateColumns: screens.xl ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: token.marginMD, alignItems: 'start' }}>
                  {sections.map((section) => (
                    <Card key={section.key} size="small" title={t(config.sectionLabels[section.key] ?? section.key)} style={{ minWidth: 0 }}>
                      <Descriptions
                        size="small"
                        column={1}
                        items={section.fields.map(({ key, value: raw }) => ({
                          key,
                          label: <span title={key}>{t(config.fields[key]?.label ?? key)}</span>,
                          children: <Typography.Text style={{ overflowWrap: 'anywhere' }}>{formatField(key, raw)}</Typography.Text>
                        }))}
                      />
                    </Card>
                  ))}
                </div>
                {!sections.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('服务端未返回此项统计')} />}
              </Flex>
            )
          }
        ]}
      />
    </Flex>
  )
}
