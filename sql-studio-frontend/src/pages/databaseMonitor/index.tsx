import { ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Empty, Flex, Form, Select, Statistic, Typography } from 'antd'

import ContentLoading from '@/components/contentLoading'
import DatabasePage from '@/components/databasePage'
import type { DatabasePageProps } from '@/components/databasePage'
import EngineIcon from '@/components/engineIcon'
import ErrorNotice from '@/components/errorNotice'
import { getDatabaseAdapter } from '@/databases'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'

import { useDatabaseMonitor } from './hooks/useDatabaseMonitor'

const metricLabels: Readonly<Record<string, string>> = {
  connections: '当前连接数',
  running_threads: '运行线程数',
  queries: '累计客户端语句',
  slow_queries: '累计慢查询',
  failed_connections: '累计连接失败',
  received_bytes: '累计接收流量',
  sent_bytes: '累计发送流量',
  uptime: '运行时间',
  transactions_committed: '累计提交事务',
  transactions_rolled_back: '累计回滚事务',
  size_bytes: '数据库大小',
  cache_hit_percent: '缓存命中率',
  deadlocks: '累计死锁',
  temp_bytes: '累计临时文件写入',
  rows_changed: '累计变更行数',
  tables: '表数量',
  regions: '主分片数',
  approximate_rows: '估算行数',
  region_disk_bytes: '分片磁盘占用',
  region_memtable_bytes: '分片写入缓冲占用',
  region_sst_files: '分片 SST 文件数'
}

function formatMetric(key: string, value: string, locale: string) {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  if (key === 'uptime') {
    const seconds = Number(value)
    const unit = seconds >= 3600 ? 'hour' : seconds >= 60 ? 'minute' : 'second'
    const divisor = { hour: 3600, minute: 60, second: 1 }[unit]
    return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(seconds / divisor)
  }
  if (key.endsWith('_bytes')) {
    const bytes = Number(value)
    if (bytes >= 1024 ** 3) return `${format.format(bytes / 1024 ** 3)} GiB`
    if (bytes >= 1024 ** 2) return `${format.format(bytes / 1024 ** 2)} MiB`
    if (bytes >= 1024) return `${format.format(bytes / 1024)} KiB`
    return `${format.format(bytes)} B`
  }
  if (key === 'cache_hit_percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(Number(value) / 100)
  return /^\d+$/.test(value) ? format.format(BigInt(value)) : value
}

type Props = DatabasePageProps & { connections: readonly Connection[]; initialConnection?: Connection; initialDatabase: string }

export default function DatabaseMonitor({ connections, initialConnection, initialDatabase, ...pageProps }: Props) {
  const { t, language } = useTranslation()
  const monitor = useDatabaseMonitor(connections, initialConnection, initialDatabase)
  const { connection, result } = monitor
  const snapshot = result?.snapshot
  const defaultDatabase = connection?.database || getDatabaseAdapter(connection?.type).profile.database
  const options = connections.map((item) => ({
    value: item.id,
    searchText: item.name,
    label: (
      <Flex align="center" gap="small">
        <EngineIcon type={item.type} variant="logo" size={20} />
        <Typography.Text ellipsis title={item.name}>
          {item.name}
        </Typography.Text>
      </Flex>
    )
  }))
  return (
    <DatabasePage title={t('监控指标')} {...pageProps}>
      {connections.length ? (
        <>
          <Card size="small">
            <Form layout="horizontal" labelCol={{ flex: '88px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }}>
              <Form.Item label={t('连接')} htmlFor="monitor-connection" style={{ marginBottom: monitor.databaseScoped ? 12 : 0 }}>
                <Select
                  id="monitor-connection"
                  value={connection?.id}
                  options={options}
                  showSearch={{ optionFilterProp: 'searchText' }}
                  placeholder={t('选择连接')}
                  onChange={(id) => monitor.selectConnection(id)}
                />
              </Form.Item>
              {connection && monitor.databaseScoped && (
                <Form.Item label={t('数据库')} htmlFor="monitor-database" style={{ marginBottom: 0 }}>
                  <Select
                    id="monitor-database"
                    value={monitor.database}
                    showSearch={{ optionFilterProp: 'label' }}
                    options={[
                      { value: '', label: defaultDatabase ? t('默认数据库（{name}）', { name: defaultDatabase }) : t('默认数据库') },
                      ...[...new Set([...monitor.databases, ...(monitor.database ? [monitor.database] : [])])].map((name) => ({ value: name, label: name }))
                    ]}
                    onChange={monitor.selectDatabase}
                  />
                </Form.Item>
              )}
            </Form>
          </Card>
          {connection && (
            <Flex align="center" justify="space-between" gap="small" wrap>
              <Typography.Text type="secondary">
                {snapshot?.database || (monitor.databaseScoped ? '' : t('实例统计'))}
                {snapshot && ` · ${t('采样于 {time}', { time: new Date(snapshot.sampledAt).toLocaleTimeString(language) })}`}
              </Typography.Text>
              <Button icon={<ReloadOutlined />} onClick={monitor.refresh}>
                {t('刷新')}
              </Button>
            </Flex>
          )}
          <ErrorNotice error={result?.error} />
          {snapshot ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12 }}>
              {snapshot.metrics.map(({ key, value }) => (
                <Card key={key} size="small">
                  <Statistic title={t(metricLabels[key] ?? key)} value={value} formatter={() => formatMetric(key, value, language)} />
                </Card>
              ))}
            </div>
          ) : connection && !result?.error ? (
            <ContentLoading label={t('正在读取数据库指标…')} style={{ minHeight: 120 }} />
          ) : null}
        </>
      ) : (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('保存数据库连接后即可查看监控指标。')} />
        </Card>
      )}
    </DatabasePage>
  )
}
