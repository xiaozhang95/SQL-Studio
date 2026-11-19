import { ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Empty, Flex, Select, Typography } from 'antd'

import ContentLoading from '@/components/contentLoading'
import DatabasePage from '@/components/databasePage'
import type { DatabasePageProps } from '@/components/databasePage'
import EngineIcon from '@/components/engineIcon'
import { getDatabaseMonitorPanel, getDatabaseProfile } from '@/databases'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'

import { refreshIntervals, useDatabaseMonitor } from './hooks/useDatabaseMonitor'

type Props = DatabasePageProps & { connections: readonly Connection[]; initialConnection?: Connection; initialDatabase: string }

export default function DatabaseMonitor({ connections, initialConnection, initialDatabase, ...pageProps }: Props) {
  const { t, language } = useTranslation()
  const monitor = useDatabaseMonitor(connections, initialConnection, initialDatabase)
  const { connection, result } = monitor
  const snapshot = result?.snapshot
  const MonitorPanel = getDatabaseMonitorPanel(connection?.type)
  const defaultDatabase = connection?.database || getDatabaseProfile(connection?.type).database
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
  const intervalOptions = refreshIntervals.map((value) => ({
    value,
    label: value === 0 ? t('已关闭') : value < 60 ? t('每 {count} 秒', { count: value }) : t('每 {count} 分钟', { count: value / 60 })
  }))
  return (
    <DatabasePage title={t('监控指标')} errors={[result?.error]} {...pageProps}>
      {connections.length ? (
        <>
          <Card size="small">
            <Flex gap="small" wrap>
              <Select
                aria-label={t('选择连接')}
                style={{ flex: '1 1 260px', minWidth: 0 }}
                value={connection?.id}
                options={options}
                showSearch={{ optionFilterProp: 'searchText' }}
                placeholder={t('选择连接')}
                onChange={monitor.selectConnection}
              />
              {connection && monitor.databaseScoped && (
                <Select
                  aria-label={t('数据库')}
                  style={{ flex: '1 1 240px', minWidth: 0 }}
                  value={monitor.database}
                  showSearch={{ optionFilterProp: 'label' }}
                  options={[
                    { value: '', label: defaultDatabase ? t('默认数据库（{name}）', { name: defaultDatabase }) : t('默认数据库') },
                    ...[...new Set([...monitor.databases, ...(monitor.database ? [monitor.database] : [])])].map((name) => ({ value: name, label: name }))
                  ]}
                  onChange={monitor.selectDatabase}
                />
              )}
            </Flex>
          </Card>
          {connection && (
            <Flex align="center" justify="space-between" gap="small" wrap>
              <Typography.Text type="secondary">
                {snapshot?.database || (monitor.databaseScoped ? '' : t('实例统计'))}
                {snapshot && ` · ${t('采样于 {time}', { time: new Date(snapshot.sampledAt).toLocaleTimeString(language) })}`}
              </Typography.Text>
              <Flex align="center" gap="small" wrap style={{ marginInlineStart: 'auto' }}>
                <Select aria-label={t('自动刷新')} value={monitor.refreshInterval} options={intervalOptions} prefix={t('自动刷新')} style={{ minWidth: 164 }} onChange={monitor.setRefreshInterval} />
                <Button icon={<ReloadOutlined />} loading={monitor.loading} onClick={monitor.refresh}>
                  {t('刷新')}
                </Button>
              </Flex>
            </Flex>
          )}
          {snapshot ? (
            <MonitorPanel key={connection?.id} snapshot={snapshot} history={result?.history ?? []} />
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
