import { LinkOutlined, SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Flex, Form, Grid, Input, Select, Steps, theme, Typography } from 'antd'

import DatabasePage from '@/components/databasePage'
import type { DatabasePageProps } from '@/components/databasePage'
import EngineIcon from '@/components/engineIcon'
import StudioIcon from '@/components/studioIcon'
import { useNavigationLockEffect } from '@/contexts/navigationLock'
import { sqlDatabaseProfiles } from '@/databases'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'

import DatabaseSyncConnection from './components/databaseSyncConnection'
import SyncResult from './components/syncResult'
import { useDatabaseSync } from './hooks/useDatabaseSync'

type Props = DatabasePageProps & {
  connections: readonly Connection[]
  initialConnection?: Connection
  onCreated: (id: string) => void
  onOpenTarget?: (connectionId: string, database: string) => void
}

export default function DatabaseSync({ connections, initialConnection, onCreated, onOpenTarget, ...pageProps }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const model = useDatabaseSync(connections, initialConnection, onCreated)
  const { values, status, plan, result, update } = model
  const checking = status === 'checking'
  const running = status === 'running'
  const busy = checking || running
  useNavigationLockEffect(running)
  const options = model.eligibleConnections.map(({ id, name, host, port }) => ({ value: id, label: `${name} · ${host}:${port}` }))
  const externalSource = model.choices.source === model.externalID
  const externalTarget = model.choices.target === model.externalID
  const connectionLabel = (side: 'source' | 'target') =>
    model.choices[side] === model.externalID
      ? `${model.credentials[side].host.trim()}:${model.credentials[side].port || model.profile.port}`
      : (model.eligibleConnections.find(({ id }) => id === model.choices[side])?.name ?? '')
  const done = status === 'completed'
  const checkText =
    plan &&
    (plan.skippedViews
      ? t('检查通过，将新建目标库并同步 {count} 张表，跳过 {views} 个视图。', { count: plan.tables, views: plan.skippedViews })
      : t('检查通过，将新建目标库并同步 {count} 张表。', { count: plan.tables }))
  const breadcrumb = [connectionLabel('source'), connectionLabel('target')].filter(Boolean).join(' → ') || undefined

  return (
    <DatabasePage title={t('同步数据库')} breadcrumb={breadcrumb} errors={[model.databaseError, model.error, result?.error]} {...pageProps}>
      <Card size="small">
        <Flex align="center" gap="middle" wrap>
          <Steps
            size="small"
            current={result ? 2 : plan || checking ? 1 : 0}
            status={status === 'error' ? 'error' : done ? 'finish' : 'process'}
            items={[{ title: t('配置同步') }, { title: t('同步检查') }, { title: t('执行同步') }]}
            style={{ flex: '1 1 480px', minWidth: 0, maxWidth: 470 }}
          />
          <Select
            aria-label={t('数据库类型')}
            value={model.profile.value}
            style={{ width: 220, flex: '0 0 220px', marginInlineStart: 'auto' }}
            disabled={busy}
            options={sqlDatabaseProfiles.map(({ value, label }) => ({
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
        </Flex>
      </Card>
      {!result ? (
        <>
          <Form layout="horizontal" labelCol={{ flex: '88px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} disabled={busy}>
            <Flex vertical gap="middle">
              <div style={{ display: 'grid', gridTemplateColumns: screens.lg ? 'minmax(0, 1fr) auto minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: token.marginSM }}>
                <Card
                  size="small"
                  title={
                    <Flex gap="small" align="center">
                      <EngineIcon type={model.profile.value} variant="logo" size={18} />
                      {t('源端')}
                    </Flex>
                  }
                  actions={[
                    <Button
                      key="external"
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => model.choose('source', externalSource ? (model.eligibleConnections[0]?.id ?? '') : model.externalID)}
                    >
                      {externalSource ? t('使用已保存连接') : t('使用外部连接')}
                    </Button>
                  ]}
                >
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
                  <Form.Item label={t('源数据库')} htmlFor="sync-source-db" style={{ marginBottom: 4 }}>
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
                  <Typography.Text type="secondary" style={{ display: 'block', paddingInlineStart: 88 }}>
                    {t('将复制全部表，自动跳过视图')}
                  </Typography.Text>
                </Card>
                <Button
                  style={{ alignSelf: 'center', justifySelf: 'center', transform: screens.lg ? undefined : 'rotate(90deg)' }}
                  shape="circle"
                  aria-label={t('交换源端与目标端')}
                  title={t('交换源端与目标端')}
                  icon={<StudioIcon name="swap" size={14} />}
                  disabled={busy}
                  onClick={model.swap}
                />
                <Card
                  size="small"
                  title={
                    <Flex gap="small" align="center">
                      <EngineIcon type={model.profile.value} variant="logo" size={18} />
                      {t('目标端')}
                    </Flex>
                  }
                  actions={[
                    <Button
                      key="external"
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => model.choose('target', externalTarget ? (model.eligibleConnections[0]?.id ?? '') : model.externalID)}
                    >
                      {externalTarget ? t('使用已保存连接') : t('使用外部连接')}
                    </Button>
                  ]}
                >
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
                  <Form.Item label={t('目标数据库')} htmlFor="sync-target-db" style={{ marginBottom: 4 }}>
                    <Input
                      id="sync-target-db"
                      value={values.targetDatabase}
                      maxLength={64}
                      placeholder={t('输入尚未存在的库名')}
                      onChange={(event) => update({ targetDatabase: event.target.value })}
                    />
                  </Form.Item>
                  <Typography.Text type="secondary" style={{ display: 'block', paddingInlineStart: 88 }}>
                    {t('检查通过后新建；目标库已存在时立即停止')}
                  </Typography.Text>
                </Card>
              </div>
              <Card
                size="small"
                title={
                  <Flex gap="small" align="center">
                    <SettingOutlined />
                    {t('同步选项')}
                  </Flex>
                }
                styles={{ header: { minHeight: 42, paddingInline: 14 }, body: { padding: 14 } }}
              >
                <Flex align="flex-start" gap={10}>
                  <Checkbox checked={values.data} disabled={busy || !values.structure} onChange={(event) => update({ data: event.target.checked })} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>{t('同时复制表数据')}</div>
                    <Typography.Text type="secondary">{t('关闭时只同步表结构；开启后将逐表复制数据，已创建的库和已写入记录不会回滚。')}</Typography.Text>
                  </div>
                  {plan && (
                    <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
                      {t('跳过 {value1} 个视图', { value1: plan.skippedViews })}
                    </Typography.Text>
                  )}
                </Flex>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <Checkbox checked={values.createDatabase} disabled={busy} onChange={(event) => update({ createDatabase: event.target.checked })}>
                    {t('目标库不存在时新建')}
                  </Checkbox>
                </div>
              </Card>
            </Flex>
          </Form>
          {plan ? (
            <Alert type="success" showIcon title={t('检查通过')} description={checkText} styles={{ description: { overflowWrap: 'anywhere' } }} />
          ) : (
            <Alert type="info" variant="filled" showIcon title={t('目标库已存在时立即停止。同步新库需要勾选目标选项。')} style={{ backgroundColor: 'var(--primary-soft)' }} />
          )}
        </>
      ) : (
        <SyncResult
          status={status}
          result={result}
          plan={plan}
          engineLabel={model.profile.label}
          sourceDatabase={values.sourceDatabase}
          targetDatabase={values.targetDatabase.trim()}
          withData={values.data}
        />
      )}
      <Flex justify="space-between" align="center" gap="small" wrap>
        {result ? (
          <Button disabled={running} onClick={model.back}>
            {t('返回配置')}
          </Button>
        ) : (
          <Typography.Text type="secondary">{t('同步内容：{value1}', { value1: values.data ? t('结构 + 数据') : t('仅结构') })}</Typography.Text>
        )}
        <Flex gap="small" wrap>
          {running && (
            <Button danger onClick={model.cancel}>
              {t('取消同步')}
            </Button>
          )}
          {result && (
            <Button disabled={running} onClick={pageProps.onBack}>
              {t('返回工作区')}
            </Button>
          )}
          {result ? (
            <Button
              type="primary"
              disabled={!done || externalTarget || !model.choices.target || !values.targetDatabase.trim()}
              onClick={() => onOpenTarget?.(model.choices.target, values.targetDatabase.trim())}
            >
              {t('打开目标连接')}
            </Button>
          ) : (
            <>
              <Button disabled={busy} onClick={pageProps.onBack}>
                {t('取消')}
              </Button>
              {plan && (
                <Button disabled={busy} onClick={() => void model.check()}>
                  {t('同步检查')}
                </Button>
              )}
              <Button type="primary" loading={!plan && checking} disabled={!model.valid || busy} onClick={() => void (plan ? model.run() : model.check())}>
                {plan ? t('开始同步') : t('同步检查')}
              </Button>
            </>
          )}
        </Flex>
      </Flex>
    </DatabasePage>
  )
}
