import { ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import { Alert, Card, Descriptions, Flex, Progress, Statistic, theme, Timeline } from 'antd'
import { useEffect, useRef, useState } from 'react'

import ErrorNotice from '@/components/errorNotice'
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
  source: string
  target: string
  withData: boolean
}

export default function SyncResult({ status, result, plan, source, target, withData }: Props) {
  const { t, language } = useTranslation()
  const { token } = theme.useToken()
  const [now, setNow] = useState(Date.now)
  const log = useRef<HTMLDivElement>(null)
  const running = status === 'running'
  const done = status === 'completed'
  const statusText = done ? '同步完成' : status === 'cancelled' ? '同步已取消' : status === 'error' ? '同步已停止' : '正在同步'
  const { progress, logs, error, endedAt, startedAt } = result
  const tables = progress.tables || plan?.tables || 0
  const seconds = (Math.max(0, (endedAt ?? now) - startedAt) / 1000).toFixed(1)
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [running])
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [logs, status])

  const events = logs.map((item, index) => ({
    key: index,
    content: item.table ? `${t(phaseLabels[item.phase])} · ${item.table}` : t(phaseLabels[item.phase])
  }))
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: token.marginMD, alignItems: 'start' }}>
        <Card
          title={
            <Flex gap="small" align="center">
              <ClockCircleOutlined />
              {t('执行进度')}
            </Flex>
          }
        >
          <Flex vertical gap="middle">
            <Descriptions
              column={1}
              size="small"
              styles={{ label: { whiteSpace: 'nowrap' }, content: { minWidth: 0, overflowWrap: 'anywhere' } }}
              items={[
                { key: 'source', label: t('源数据库'), children: source },
                { key: 'target', label: t('目标数据库'), children: target },
                { key: 'mode', label: t('同步内容'), children: t(withData ? '结构和数据' : '仅结构') },
                { key: 'status', label: t('状态'), children: t(statusText) }
              ]}
            />
            <Progress percent={done ? 100 : tables > 0 ? Math.floor((100 * progress.completed) / tables) : 0} status={done ? 'success' : error ? 'exception' : running ? 'active' : 'normal'} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: token.marginSM }}>
              <Statistic title={t('已处理对象')} value={`${progress.completed} / ${tables}`} />
              <Statistic title={t('已写入记录')} value={progress.rows.toLocaleString(language)} />
              <Statistic title={t('时间')} value={`${seconds}s`} />
              <Statistic title={t('跳过视图')} value={progress.tables ? progress.skippedViews : (plan?.skippedViews ?? 0)} />
            </div>
          </Flex>
        </Card>
        <Card
          title={
            <Flex gap="small" align="center">
              <FileTextOutlined />
              {t('同步日志')}
            </Flex>
          }
        >
          <div ref={log} role="log" aria-label={t('同步日志')} style={{ maxHeight: 340, overflowY: 'auto', overflowWrap: 'anywhere' }}>
            <Timeline items={running ? events : [...events, { key: -1, content: t(statusText), color: done ? 'green' : error ? 'red' : 'gray' }]} />
          </div>
        </Card>
      </div>
      <ErrorNotice title={t('同步已停止')} error={error ? t(error) : undefined} />
      {(status === 'cancelled' || error) && <Alert type="warning" showIcon title={t(progress.created ? '已创建的库、表及已写入记录会保留。' : '如操作在建库时中断，请先检查目标库状态。')} />}
    </>
  )
}
