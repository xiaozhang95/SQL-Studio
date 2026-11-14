import { Alert, Button, Card, Checkbox, Descriptions, Flex, Form, Input, Progress, Select, Steps, theme } from 'antd'
import { useEffect, useRef, useState } from 'react'

import DatabasePage from '@/components/databasePage'
import type { DatabasePageProps } from '@/components/databasePage'
import EngineIcon from '@/components/engineIcon'
import ErrorNotice from '@/components/errorNotice'
import { databaseProfiles } from '@/databases'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'

import DatabaseSyncConnection from './components/databaseSyncConnection'
import { useDatabaseSync } from './hooks/useDatabaseSync'

const phaseLabels = {
  checking: '正在重新检查源库和目标库',
  created: '已创建目标库',
  structure: '复制表结构',
  data: '传输表数据',
  table_done: '已完成表'
} as const

type Props = DatabasePageProps & {
  connections: readonly Connection[]
  initialConnection?: Connection
  onCreated: (id: string) => void
}

export default function DatabaseSync({ connections, initialConnection, onCreated, ...pageProps }: Props) {
  const { t, language } = useTranslation()
  const { token } = theme.useToken()
  const model = useDatabaseSync(connections, initialConnection, onCreated)
  const { values, status, plan, result, update } = model
  const checking = status === 'checking'
  const running = status === 'running'
  const busy = checking || running
  const [now, setNow] = useState(Date.now)
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [running])
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [result?.logs])
  const options = model.eligibleConnections.map(({ id, name, host, port }) => ({ value: id, label: `${name} · ${host}:${port}` }))
  const externalSource = model.choices.source === model.externalID
  const connectionLabel = (side: 'source' | 'target') =>
    model.choices[side] === model.externalID
      ? `${model.credentials[side].host.trim()}:${model.credentials[side].port || model.profile.port}`
      : (model.eligibleConnections.find(({ id }) => id === model.choices[side])?.name ?? '')
  const progress = result?.progress
  const done = status === 'completed'
  const cancelled = status === 'cancelled'
  const statusText = done ? '同步完成' : cancelled ? '同步已取消' : status === 'error' ? '同步已停止' : '正在同步'
  const mode = values.data ? t('结构和数据') : t('仅结构')
  const checkText =
    plan &&
    (plan.skippedViews
      ? t('检查通过，将新建目标库并同步 {count} 张表，跳过 {views} 个视图。', { count: plan.tables, views: plan.skippedViews })
      : t('检查通过，将新建目标库并同步 {count} 张表。', { count: plan.tables }))

  return (
    <DatabasePage title={t('同步数据库')} backDisabled={running} {...pageProps}>
      <Card>
        <Flex vertical gap="middle">
          <Steps
            size="small"
            current={result ? 2 : plan || checking ? 1 : 0}
            status={status === 'error' ? 'error' : done ? 'finish' : 'process'}
            items={[{ title: t('配置同步') }, { title: t('同步检查') }, { title: t('执行同步') }]}
          />
          {!result ? (
            <>
              <Form layout="horizontal" labelCol={{ flex: '108px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} disabled={busy}>
                <Form.Item label={t('数据库类型')} htmlFor="sync-engine">
                  <Select
                    id="sync-engine"
                    value={model.profile.value}
                    options={databaseProfiles.map(({ value, label }) => ({
                      value,
                      label: (
                        <Flex align="center" gap="small">
                          <EngineIcon type={value} variant="logo" size={20} />
                          <span>{label}</span>
                        </Flex>
                      )
                    }))}
                    onChange={model.changeEngine}
                  />
                </Form.Item>
                <DatabaseSyncConnection
                  side="source"
                  profile={model.profile}
                  options={options}
                  value={model.choices.source}
                  externalID={model.externalID}
                  credentials={model.credentials.source}
                  onChange={(value) => model.choose('source', value)}
                  onCredentials={(patch) => model.updateExternal('source', patch)}
                />
                <Form.Item label={t('源数据库')} htmlFor="sync-source-db" validateStatus={model.databaseError ? 'error' : undefined} help={model.databaseError ? t(model.databaseError) : undefined}>
                  {externalSource ? (
                    <Flex gap="small" wrap>
                      <Input
                        id="sync-source-db"
                        value={values.sourceDatabase}
                        style={{ flex: '1 1 180px' }}
                        maxLength={64}
                        placeholder={t('输入源数据库名称')}
                        onChange={(event) => update({ sourceDatabase: event.target.value })}
                      />
                      <Button disabled={!model.canReadSource || busy} loading={model.loading} onClick={model.refreshSource}>
                        {t('读取源数据库')}
                      </Button>
                      {model.databases.length > 0 && (
                        <Select
                          aria-label={t('选择源数据库')}
                          value={model.databases.includes(values.sourceDatabase) ? values.sourceDatabase : undefined}
                          options={model.databases.map((name) => ({ label: name, value: name }))}
                          style={{ width: '100%' }}
                          showSearch
                          placeholder={t('选择源数据库')}
                          onChange={(sourceDatabase) => update({ sourceDatabase })}
                        />
                      )}
                    </Flex>
                  ) : (
                    <Select
                      id="sync-source-db"
                      value={values.sourceDatabase || undefined}
                      options={model.databases.map((name) => ({ label: name, value: name }))}
                      showSearch
                      disabled={!model.choices.source || busy}
                      loading={model.loading}
                      placeholder={t('选择源数据库')}
                      onChange={(sourceDatabase) => update({ sourceDatabase })}
                    />
                  )}
                </Form.Item>
                <DatabaseSyncConnection
                  side="target"
                  profile={model.profile}
                  options={options}
                  value={model.choices.target}
                  externalID={model.externalID}
                  credentials={model.credentials.target}
                  onChange={(value) => model.choose('target', value)}
                  onCredentials={(patch) => model.updateExternal('target', patch)}
                />
                <Form.Item label={t('目标数据库')} htmlFor="sync-target-db">
                  <Input id="sync-target-db" value={values.targetDatabase} maxLength={64} placeholder={t('输入尚未存在的库名')} onChange={(event) => update({ targetDatabase: event.target.value })} />
                </Form.Item>
                <Form.Item label={t('同步内容')}>
                  <Flex wrap gap="middle">
                    <Checkbox checked={values.structure} onChange={(event) => update({ structure: event.target.checked })}>
                      {t('表结构')}
                    </Checkbox>
                    <Checkbox checked={values.data} disabled={!values.structure || busy} onChange={(event) => update({ data: event.target.checked })}>
                      {t('表数据')}
                    </Checkbox>
                  </Flex>
                </Form.Item>
                <Form.Item label={t('目标选项')} style={{ marginBottom: 0 }}>
                  <Checkbox checked={values.createDatabase} onChange={(event) => update({ createDatabase: event.target.checked })}>
                    {t('目标库不存在时新建')}
                  </Checkbox>
                </Form.Item>
              </Form>
              <Alert type={plan ? 'success' : 'info'} showIcon title={checkText || t('目标库已存在时立即停止。同步新库需要勾选表结构。')} />
              <ErrorNotice title={t('同步检查失败')} error={model.error ? t(model.error) : undefined} />
            </>
          ) : (
            progress && (
              <>
                <Descriptions
                  column={{ xs: 1, sm: 2 }}
                  size="small"
                  styles={{ label: { whiteSpace: 'nowrap' }, content: { minWidth: 0, overflowWrap: 'anywhere' } }}
                  items={[
                    { key: 'source', label: t('源数据库'), children: `${connectionLabel('source')} / ${values.sourceDatabase}` },
                    { key: 'target', label: t('目标数据库'), children: `${connectionLabel('target')} / ${values.targetDatabase.trim()}` },
                    { key: 'mode', label: t('同步内容'), children: mode },
                    { key: 'status', label: t('状态'), children: t(statusText) },
                    { key: 'tables', label: t('已处理对象'), children: `${progress.completed} / ${progress.tables || plan?.tables || 0}` },
                    { key: 'rows', label: t('已写入记录'), children: progress.rows.toLocaleString(language) },
                    { key: 'time', label: t('时间'), children: `${(Math.max(0, (result.endedAt ?? now) - result.startedAt) / 1000).toFixed(1)}s` },
                    { key: 'views', label: t('跳过视图'), children: progress.tables ? progress.skippedViews : (plan?.skippedViews ?? 0) }
                  ]}
                />
                <ErrorNotice title={t('同步已停止')} error={result.error ? t(result.error) : undefined} />
                {(cancelled || result.error) && <Alert type="warning" showIcon title={t(progress.created ? '已创建的库、表及已写入记录会保留。' : '如操作在建库时中断，请先检查目标库状态。')} />}
                <div
                  ref={log}
                  role="log"
                  aria-label={t('同步日志')}
                  style={{ height: 180, overflow: 'auto', overflowWrap: 'anywhere', border: `1px solid ${token.colorBorder}`, padding: token.paddingSM }}
                >
                  {result.logs.map((item, index) => (
                    <div key={`${item.phase}:${item.table ?? ''}:${index}`}>
                      {t(phaseLabels[item.phase])}
                      {item.table && ` · ${item.table}`}
                    </div>
                  ))}
                  {!running && <div>{t(statusText)}</div>}
                </div>
                <Progress
                  percent={done ? 100 : progress.tables > 0 ? Math.floor((100 * progress.completed) / progress.tables) : 0}
                  status={done ? 'success' : result.error ? 'exception' : running ? 'active' : 'normal'}
                />
              </>
            )
          )}
          <Flex justify="end" gap="small" wrap>
            {running ? (
              <Button danger onClick={model.cancel}>
                {t('取消同步')}
              </Button>
            ) : result ? (
              <Button onClick={model.back}>{t('修改配置')}</Button>
            ) : (
              <>
                <Button loading={checking} disabled={!model.valid || busy} onClick={() => void model.check()}>
                  {t('同步检查')}
                </Button>
                <Button disabled={!plan || !model.valid || busy} onClick={() => void model.run()}>
                  {t('开始同步')}
                </Button>
              </>
            )}
          </Flex>
        </Flex>
      </Card>
    </DatabasePage>
  )
}
