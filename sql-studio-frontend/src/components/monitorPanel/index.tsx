import { Alert, Card, Descriptions, Empty, Flex, Progress, Statistic, Tabs, Tag, theme, Typography } from 'antd'

import type { DatabaseMonitorPanelProps } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { MetricDefinition, MonitorPanelConfig } from '@/typings/databaseMonitor'
import { formatMetric, metricValue, sampleValue } from '@/utils/monitorMetrics'

import TrendChart from '../monitorTrendChart'

type Props = DatabaseMonitorPanelProps & { config: MonitorPanelConfig }

/** Common layout; field definitions and sampling semantics remain engine-owned. */
export default function MonitorPanel({ snapshot, history, config }: Props) {
  const { t, language } = useTranslation()
  const { token } = theme.useToken()
  const detail = snapshot.details
  const samples = history.at(-1) === snapshot ? history : [...history, snapshot]
  const value = (metric: MetricDefinition) => sampleValue(samples, samples.length - 1, metric)
  const statistic = (metric: MetricDefinition) => (
    <Statistic
      key={`${metric.key}:${metric.source ?? 'value'}`}
      title={t(metric.label)}
      value={value(metric) ?? '—'}
      formatter={() => formatMetric(value(metric), metric.format, language)}
      style={{ minWidth: 0, overflowWrap: 'anywhere' }}
    />
  )
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
            {detail?.role && <Tag>{t(config.roleLabels?.[detail.role] ?? detail.role)}</Tag>}
          </Flex>
        }
      >
        <div className="database-monitor-metrics" style={{ display: 'grid', gap: token.marginLG }}>
          {config.overview.map(statistic)}
        </div>
        {config.capacity && percent !== undefined && (
          <Flex vertical gap="small" style={{ marginTop: token.marginMD }}>
            <Typography.Text type="secondary">
              {t(config.capacity.label)}: {formatMetric(String(percent), 'percent', language)} · {formatMetric(String(used), 'count', language)} / {formatMetric(String(limit), 'count', language)}
            </Typography.Text>
            <Progress percent={Math.min(100, percent)} showInfo={false} size="small" status={percent >= 100 ? 'exception' : 'normal'} />
          </Flex>
        )}
      </Card>
      <Tabs
        defaultActiveKey="activity"
        items={[
          {
            key: 'activity',
            label: t('活动状态'),
            children: (
              <Flex vertical gap="middle">
                <Typography.Text type="secondary">{t('趋势仅记录本页打开后的采样；可开启自动刷新连续观察。')}</Typography.Text>
                {config.notice && <Typography.Text type="secondary">{t(config.notice)}</Typography.Text>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: token.marginMD }}>
                  {config.charts.map((chart) => (
                    <TrendChart key={chart.key} title={chart.title} series={chart.series} history={samples} />
                  ))}
                </div>
                <div className="database-monitor-metrics" style={{ display: 'grid', gap: token.marginMD }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: token.marginMD, alignItems: 'start' }}>
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
