import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons'
import { Button, Card, Checkbox, Flex, Form, Input, Select, Steps, Tag, theme } from 'antd'

import DatabasePage from '@/components/databasePage'
import type { DatabasePageProps } from '@/components/databasePage'
import { useNavigationLockEffect } from '@/contexts/navigationLock'
import EngineIcon from '@/components/engineIcon'
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
}

export default function DatabaseSync({ connections, initialConnection, onCreated, ...pageProps }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const model = useDatabaseSync(connections, initialConnection, onCreated)
  const { values, status, plan, result, update } = model
  const checking = status === 'checking'
  const running = status === 'running'
  const busy = checking || running
  useNavigationLockEffect(running)
  const options = model.eligibleConnections.map(({ id, name, host, port }) => ({ value: id, label: `${name} · ${host}:${port}` }))
  const externalSource = model.choices.source === model.externalID
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
  const statusLabel =
    status === 'checking'
      ? t('正在检查')
      : status === 'running'
        ? t('正在同步')
        : status === 'completed'
          ? t('同步完成')
          : status === 'error'
            ? t('同步已停止')
            : status === 'cancelled'
              ? t('同步已取消')
              : t('未开始')
  const statusClass = status === 'completed' ? ' is-connected' : status === 'error' || status === 'cancelled' ? ' is-warning' : ''
  const breadcrumb = [connectionLabel('source'), connectionLabel('target')].filter(Boolean).join(' → ') || undefined

  return (
    <DatabasePage
      title={t('同步数据库')}
      breadcrumb={breadcrumb}
      contentWidth={1120}
      errors={[model.databaseError, model.error, result?.error]}
      headerActions={
        <span className={`connection-status-pill${statusClass}`}>
          <span className="connection-status-dot" />
          <span>{statusLabel}</span>
        </span>
      }
      {...pageProps}
    >
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
            style={{ width: 240, flex: '0 0 240px', marginInlineStart: 'auto' }}
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
          <Form layout="horizontal" labelCol={{ flex: '96px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} disabled={busy}>
            <Flex vertical gap="middle">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 385px), 1fr))', gap: token.marginMD, alignItems: 'start' }}>
                <Card
                  size="small"
                  title={
                    <Flex gap="small" align="center">
                      <EngineIcon type={model.profile.value} variant="logo" size={18} />
                      {t('源端')}
                      {model.choices.source && <Tag color="success">{t('已连接')}</Tag>}
                    </Flex>
                  }
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
                  <Form.Item label={t('源数据库')} htmlFor="sync-source-db" style={{ marginBottom: 0 }}>
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
                </Card>
                <Card
                  size="small"
                  title={
                    <Flex gap="small" align="center">
                      <EngineIcon type={model.profile.value} variant="logo" size={18} />
                      {t('目标端')}
                      {model.choices.target && <Tag color="success">{t('已连接')}</Tag>}
                    </Flex>
                  }
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
                  <Form.Item label={t('目标数据库')} htmlFor="sync-target-db" style={{ marginBottom: 0 }}>
                    <Input
                      id="sync-target-db"
                      value={values.targetDatabase}
                      maxLength={64}
                      placeholder={t('输入尚未存在的库名')}
                      onChange={(event) => update({ targetDatabase: event.target.value })}
                    />
                  </Form.Item>
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
              >
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
              </Card>
            </Flex>
          </Form>
          <Flex
            align="flex-start"
            gap="small"
            style={{
              padding: '10px 12px',
              border: `1px solid ${plan ? token.colorSuccessBorder : token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              background: plan ? token.colorSuccessBg : token.colorFillAlter,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM
            }}
          >
            <InfoCircleOutlined style={{ color: plan ? token.colorSuccess : token.colorInfo, marginTop: 2 }} />
            <span style={{ overflowWrap: 'anywhere' }}>{checkText || t('目标库已存在时立即停止。同步新库需要勾选表结构。')}</span>
          </Flex>
        </>
      ) : (
        <SyncResult
          status={status}
          result={result}
          plan={plan}
          source={`${connectionLabel('source')} / ${values.sourceDatabase}`}
          target={`${connectionLabel('target')} / ${values.targetDatabase.trim()}`}
          withData={values.data}
        />
      )}
      <Flex justify="end" gap="small" wrap>
        {running ? (
          <Button danger onClick={model.cancel}>
            {t('取消同步')}
          </Button>
        ) : done ? (
          <Button onClick={pageProps.onBack}>{t('完成')}</Button>
        ) : result ? (
          <Button onClick={model.back}>{t('修改配置')}</Button>
        ) : plan ? (
          <>
            <Button disabled={busy} onClick={() => void model.check()}>
              {t('同步检查')}
            </Button>
            <Button type="primary" disabled={!model.valid || busy} onClick={() => void model.run()}>
              {t('开始同步')}
            </Button>
          </>
        ) : (
          <Button type="primary" loading={checking} disabled={!model.valid || busy} onClick={() => void model.check()}>
            {t('同步检查')}
          </Button>
        )}
      </Flex>
    </DatabasePage>
  )
}
