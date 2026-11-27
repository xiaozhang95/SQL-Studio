import { CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined, HistoryOutlined, LoadingOutlined, StopOutlined } from '@ant-design/icons'
import { Alert, Card, Collapse, Flex, Grid, Progress, Tag, theme, Timeline, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'

import { useTranslation } from '@/hooks/useTranslation'
import type { SyncPlan } from '@/services/databaseSync'

import type { useDatabaseSync } from '../../hooks/useDatabaseSync'

const phaseLabels = {
  checking: '正在重新检查源库和目标库',
  created: '已创建目标库',
  structure: '复制表结构',
  data: '传输表数据',
  table_done: '已完成表'
} as const

type Model = ReturnType<typeof useDatabaseSync>
type Props = {
  status: Model['status']
  result: NonNullable<Model['result']>
  plan?: SyncPlan
  engineLabel: string
  sourceDatabase: string
  targetDatabase: string
  withData: boolean
  schemaSync: boolean
}

export default function SyncResult({ status, result, plan, engineLabel, sourceDatabase, targetDatabase, withData, schemaSync }: Props) {
  const { t, language } = useTranslation()
  const { token } = theme.useToken()
  const statColumns = Grid.useBreakpoint().sm ? 4 : 2
  const [now, setNow] = useState(Date.now)
  const log = useRef<HTMLDivElement>(null)
  const running = status === 'running'
  const done = status === 'completed'
  const statusText = done ? '同步完成' : status === 'cancelled' ? '同步已取消' : status === 'error' ? '同步已停止' : '正在同步'
  const statusColor = done ? token.colorSuccess : status === 'error' ? token.colorError : status === 'cancelled' ? token.colorWarning : token.colorPrimary
  const { progress, logs, error, endedAt, startedAt } = result
  const tables = progress.tables || plan?.tables || 0
  const seconds = (Math.max(0, (endedAt ?? now) - startedAt) / 1000).toFixed(1)
  const percent = done ? 100 : tables > 0 ? Math.floor((100 * progress.completed) / tables) : 0
  const average = Number(seconds) > 0 ? Math.round(progress.rows / Number(seconds)) : 0
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [running])
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [logs, status])

  const elapsed = (at: number) => {
    const total = Math.max(0, Math.floor((at - startedAt) / 1000))
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }
  const events = logs.map((entry, index) => {
    const item = entry.progress
    return {
      key: index,
      content: (
        <Flex justify="space-between" align="baseline" gap={8}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {t(schemaSync && item.phase === 'checking' ? '正在重新检查源 Schema 和目标 Schema' : phaseLabels[item.phase])}
            {item.table ? ` · ${item.table}` : ''}
          </span>
          <Typography.Text type="secondary" style={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
            {elapsed(entry.at)}
          </Typography.Text>
        </Flex>
      )
    }
  })
  const finalEntry = {
    key: -1,
    color: done ? token.colorSuccess : error ? token.colorError : token.colorTextTertiary,
    content: error ? (
      <Collapse
        key={startedAt}
        items={[
          {
            key: 'error',
            label: t(statusText),
            children: (
              <Typography.Text type="danger" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {t(error)}
              </Typography.Text>
            )
          }
        ]}
      />
    ) : (
      <Flex justify="space-between" align="baseline" gap={8}>
        <span>{t(statusText)}</span>
        <Typography.Text type="secondary" style={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
          {elapsed(endedAt ?? now)}
        </Typography.Text>
      </Flex>
    )
  }
  const tableNames = [...new Set(logs.map((entry) => entry.progress.table).filter((name): name is string => Boolean(name)))]
  const statItems = [
    { key: 'objects', label: t('已处理对象'), value: `${progress.completed} / ${tables}` },
    { key: 'rows', label: t('已写入记录'), value: progress.rows.toLocaleString(language) },
    { key: 'views', label: t('跳过视图'), value: String(progress.tables ? progress.skippedViews : (plan?.skippedViews ?? 0)) },
    { key: 'speed', label: t('平均速度'), value: t('{value1} 行/s', { value1: average.toLocaleString(language) }) }
  ]
  const summary = [
    { key: 'engine', label: t('数据库类型'), value: engineLabel },
    { key: 'source', label: t(schemaSync ? '源 Schema' : '源数据库'), value: sourceDatabase },
    { key: 'target', label: t(schemaSync ? '目标 Schema' : '目标数据库'), value: targetDatabase },
    { key: 'content', label: t('同步内容'), value: withData ? t('结构 + 数据') : t('仅结构') },
    { key: 'views', label: t('跳过视图'), value: String(progress.tables ? progress.skippedViews : (plan?.skippedViews ?? 0)) }
  ]
  return (
    <>
      <Card>
        <Flex align="flex-start" gap={12}>
          <span style={{ display: 'inline-flex', flex: 'none', color: statusColor, fontSize: 34 }}>
            {running ? <LoadingOutlined spin /> : done ? <CheckCircleOutlined /> : status === 'cancelled' ? <StopOutlined /> : <CloseCircleOutlined />}
          </span>
          <Flex vertical gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Flex align="center" gap={8} wrap>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {t(statusText)}
              </Typography.Title>
              <Tag color={done ? 'success' : status === 'error' ? 'error' : 'warning'}>{percent}%</Tag>
            </Flex>
            <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
              {t(schemaSync ? '源 Schema {value1} → 目标 Schema {value2}' : '源库 {value1} → 目标库 {value2}', { value1: sourceDatabase, value2: targetDatabase })}
            </Typography.Text>
            <Progress percent={percent} status={done ? 'success' : error ? 'exception' : running ? 'active' : 'normal'} showInfo={false} strokeWidth={6} />
          </Flex>
          <Typography.Text type="secondary" style={{ flex: 'none', whiteSpace: 'nowrap' }}>
            {t('用时 {value1}s', { value1: seconds })}
          </Typography.Text>
        </Flex>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${statColumns}, minmax(0, 1fr))`,
            rowGap: token.marginSM,
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid var(--border)'
          }}
        >
          {statItems.map((item, index) => {
            const firstInRow = index % statColumns === 0
            return (
              <div key={item.key} style={{ minWidth: 0, paddingInline: firstInRow ? 0 : token.padding, borderInlineStart: firstInRow ? undefined : '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ display: 'block', overflowWrap: 'anywhere' }}>
                  {item.label}
                </Typography.Text>
                <Typography.Text strong style={{ display: 'block', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                  {item.value}
                </Typography.Text>
              </div>
            )
          })}
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: token.marginMD, alignItems: 'start' }}>
        <Card
          styles={{ body: { paddingInlineEnd: 0 } }}
          title={
            <Flex gap="small" align="center">
              <HistoryOutlined />
              {t('同步日志')}
            </Flex>
          }
        >
          <div
            ref={log}
            role="log"
            aria-label={t('同步日志')}
            style={{ maxHeight: 340, overflowY: 'auto', overflowWrap: 'anywhere', scrollbarGutter: 'stable', paddingInlineEnd: token.paddingSM }}
          >
            <Timeline items={running ? events : [...events, finalEntry]} />
          </div>
        </Card>
        <Card
          title={
            <Flex gap="small" align="center">
              <FileTextOutlined />
              {t('同步摘要')}
            </Flex>
          }
        >
          <Flex vertical>
            {summary.map((item, index) => (
              <Flex
                key={item.key}
                justify="space-between"
                align="flex-start"
                gap={12}
                style={{
                  minHeight: 28,
                  paddingBlock: 4,
                  borderBottom: index === summary.length - 1 ? undefined : '1px dashed var(--border)'
                }}
              >
                <Typography.Text type="secondary" style={{ flex: 'none' }}>
                  {item.label}
                </Typography.Text>
                <Typography.Text style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{item.value}</Typography.Text>
              </Flex>
            ))}
          </Flex>
          {(tableNames.length > 0 || tables > 0) && (
            <Flex wrap gap={4} style={{ marginTop: 10 }}>
              {tableNames.slice(0, 8).map((name) => (
                <Tag key={name} style={{ maxWidth: '100%', marginInlineEnd: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  {name}
                </Tag>
              ))}
              {tables > tableNames.slice(0, 8).length && <Tag>{`+ ${tables - tableNames.slice(0, 8).length}`}</Tag>}
            </Flex>
          )}
        </Card>
      </div>
      {(status === 'cancelled' || error) && <Alert type="warning" showIcon title={t(schemaSync ? '已创建的表及已提交的数据会保留，请先检查目标 Schema。' : progress.created ? '已创建的库、表及已写入记录会保留。' : '如操作在建库时中断，请先检查目标库状态。')} />}
    </>
  )
}
