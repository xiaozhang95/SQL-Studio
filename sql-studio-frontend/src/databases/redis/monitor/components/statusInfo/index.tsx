import { Card, Descriptions, Empty, Flex, Table, Typography } from 'antd'
import type { TableColumnsType } from 'antd'

import { appearance } from '@/constant/appearance'
import { useTranslation } from '@/hooks/useTranslation'
import type { MonitorSnapshot } from '@/typings/database'
import { formatMetric } from '@/utils/monitorMetrics'

import { infoFields, sectionLabels } from '../../constant'
import { formatInfoField } from '../../utils'

type RedisDetails = NonNullable<MonitorSnapshot['redis']>
type Keyspace = NonNullable<RedisDetails['keyspaces']>[number]

export default function StatusInfo({ detail }: { detail: RedisDetails | undefined }) {
  const { t, language } = useTranslation()
  const columns: TableColumnsType<Keyspace> = [
    { title: t('逻辑库'), dataIndex: 'database', width: 100 },
    { title: t('键数量'), dataIndex: 'keys', render: (value: string) => formatMetric(value, 'count', language) },
    { title: t('有过期时间的键'), dataIndex: 'expires', render: (value: string) => formatMetric(value, 'count', language) },
    { title: t('平均剩余 TTL'), dataIndex: 'averageTtlMillis', render: (value: string, row) => (row.expires === '0' ? '—' : formatMetric(value, 'milliseconds', language)) }
  ]
  return (
    <Flex vertical gap="middle">
      <Card size="small" title={t('键空间统计')}>
        <Table<Keyspace>
          size={appearance.tableSize}
          rowKey="database"
          dataSource={detail?.keyspaces ?? []}
          columns={columns}
          pagination={false}
          scroll={{ x: 520 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(detail?.keyspaces ? '当前没有非空逻辑库' : '服务端未返回此项统计')} /> }}
        />
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 'var(--ant-margin-md)', alignItems: 'start' }}>
        {detail?.sections.map((section) => (
          <Card key={section.key} size="small" title={t(sectionLabels[section.key] ?? section.key)} style={{ minWidth: 0 }}>
            <Descriptions
              size="small"
              column={1}
              items={section.fields.map(({ key, value }) => ({
                key,
                label: <span title={key}>{t(key in infoFields ? infoFields[key as keyof typeof infoFields].label : key)}</span>,
                children: <Typography.Text style={{ overflowWrap: 'anywhere' }}>{formatInfoField(key, value, language, t)}</Typography.Text>
              }))}
            />
          </Card>
        ))}
      </div>
      {!detail?.sections.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('服务端未返回此项统计')} />}
    </Flex>
  )
}
