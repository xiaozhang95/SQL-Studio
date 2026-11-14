import { ApiOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Flex, Form, Input, Select, Steps, theme } from 'antd'

import DatabasePage from '@/components/databasePage'
import type { DatabasePageProps } from '@/components/databasePage'
import EngineIcon from '@/components/engineIcon'
import ErrorNotice from '@/components/errorNotice'
import { databaseProfiles } from '@/databases'
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

  return (
    <DatabasePage title={t('同步数据库')} backDisabled={running} {...pageProps}>
      <Card size="small">
        <Steps
          size="small"
          current={result ? 2 : plan || checking ? 1 : 0}
          status={status === 'error' ? 'error' : done ? 'finish' : 'process'}
          items={[{ title: t('配置同步') }, { title: t('同步检查') }, { title: t('执行同步') }]}
        />
      </Card>
      {!result ? (
        <>
          <Form layout="horizontal" labelCol={{ flex: '116px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} disabled={busy}>
            <Flex vertical gap="middle">
              <Card size="small">
                <Form.Item label={t('数据库类型')} htmlFor="sync-engine" style={{ marginBottom: 0, maxWidth: 480 }}>
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
              </Card>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 385px), 1fr))', gap: token.marginMD, alignItems: 'start' }}>
                <Card
                  size="small"
                  title={
                    <Flex gap="small" align="center">
                      <DatabaseOutlined />
                      {t('源端')}
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
                  <Form.Item
                    label={t('源数据库')}
                    htmlFor="sync-source-db"
                    style={{ marginBottom: 0 }}
                    validateStatus={model.databaseError ? 'error' : undefined}
                    help={model.databaseError ? t(model.databaseError) : undefined}
                  >
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
                      <ApiOutlined />
                      {t('目标端')}
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
          <Alert type={plan ? 'success' : 'info'} showIcon title={checkText || t('目标库已存在时立即停止。同步新库需要勾选表结构。')} />
          <ErrorNotice title={t('同步检查失败')} error={model.error ? t(model.error) : undefined} />
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
    </DatabasePage>
  )
}
