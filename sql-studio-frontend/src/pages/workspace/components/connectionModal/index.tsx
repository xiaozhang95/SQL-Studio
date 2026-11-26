import { LinkOutlined, LoadingOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, AutoComplete, Button, Form, Grid, Input, InputNumber, Modal, Select, Switch, Tabs, Tag, theme, Tooltip, Typography } from 'antd'

import EngineIcon from '@/components/engineIcon'
import ErrorNotice from '@/components/errorNotice'
import { appearance, formModalStyles } from '@/constant/appearance'
import { connectionGroupLabel, connectionGroupName } from '@/constant/connectionGroup'
import { databaseProfiles } from '@/databases'
import { redisModeLabels } from '@/databases/redis'
import { DatabaseEngine } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'

import { connectionFormLabelWidth } from '../../constant/layout'
import { useConnectionForm } from '../../hooks/useConnectionForm'

type Props = {
  open: boolean
  connection?: Connection
  groups: string[]
  onClose: () => void
  onSaved: (connection: Connection) => void
}
export default function ConnectionModal({ open, connection, groups, onClose, onSaved }: Props) {
  const { language, t } = useTranslation()
  const compact = Grid.useBreakpoint().xs
  const { token } = theme.useToken()

  const { form, selectEngine, selectRedisMode, redisMode, saving, testing, status, section, engine, busy, setStatus, setSection, test, save } = useConnectionForm({ open, connection, groups, onSaved })
  const redis = engine.value === DatabaseEngine.Redis
  const sentinel = redis && redisMode === 'sentinel'
  return (
    <Modal
      forceRender
      rootClassName="sql-studio-theme"
      width={960}
      styles={formModalStyles}
      title={connection ? t('编辑连接') : t('新建连接')}
      open={open}
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      mask={{ closable: !busy }}
      afterOpenChange={(visible) => {
        if (!visible) {
          setStatus(undefined)
          setSection('general')
        }
      }}
      footer={
        <div className="modal-footer" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: token.marginXS, width: '100%', justifyContent: 'space-between' }}>
          <Button icon={<LinkOutlined />} onClick={test} loading={testing} disabled={saving}>
            {t('测试连接')}
          </Button>
          <div className="modal-actions" style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, marginInlineStart: 'auto' }}>
            <Button onClick={onClose} disabled={busy}>
              {t('取消')}
            </Button>
            <Button type="primary" onClick={save} loading={saving} disabled={testing}>
              {t('保存连接')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="connection-dialog-body" style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', height: 'min(532px, calc(100dvh - 240px))', minHeight: 0, overflow: 'hidden' }}>
        {compact ? (
          <div style={{ flex: 'none', paddingBlock: token.paddingXS, paddingInline: token.paddingSM, borderBlockEnd: '1px solid var(--border)' }}>
            <Select
              aria-label={t('数据库类型')}
              value={engine.value}
              disabled={busy || Boolean(connection)}
              style={{ width: '100%' }}
              options={databaseProfiles.map(({ value, label }) => ({ value, label }))}
              onChange={selectEngine}
            />
          </div>
        ) : (
          <aside
            className="engine-picker"
            aria-label={t('数据库类型')}
            style={{
              width: 210,
              flex: 'none',
              paddingBlock: token.paddingSM,
              paddingInline: token.paddingXS,
              borderInlineEnd: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              gap: 2,
              overflowY: 'auto'
            }}
          >
            <Typography.Text type="secondary" strong className="engine-picker-heading" style={{ display: 'block', padding: '0 8px 8px' }}>
              {t('数据库类型')}
            </Typography.Text>
            {databaseProfiles.map((profile) => (
              <Button
                key={profile.value}
                type="text"
                className="engine-choice"
                aria-pressed={profile.value === engine.value}
                disabled={busy || Boolean(connection && profile.value !== engine.value)}
                onClick={() => selectEngine(profile.value)}
                style={{
                  height: appearance.panelHeaderHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  whiteSpace: 'normal',
                  textAlign: 'left'
                }}
              >
                <EngineIcon type={profile.value} variant="logo" size={24} />
                <span>{profile.label}</span>
              </Button>
            ))}
          </aside>
        )}
        <div className="connection-settings" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            className={`connection-engine-header ${engine.className}`}
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              flexWrap: compact ? 'wrap' : undefined,
              gap: compact ? 8 : 12,
              minHeight: 62,
              padding: compact ? '8px 12px' : '0 20px',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <EngineIcon type={engine.value} variant="logo" />
            <span>{engine.label}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag style={{ marginInlineEnd: 0 }}>
                {t('默认端口 ')}
                {sentinel ? 26379 : engine.port}
              </Tag>
              <Tooltip title={t('连接凭据仅加密保存在当前电脑')}>
                <Tag icon={<SafetyCertificateOutlined />} style={{ marginInlineEnd: 0 }}>
                  {t('本地加密')}
                </Tag>
              </Tooltip>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: token.padding }}>
            <Form
              form={form}
              layout="horizontal"
              labelWrap
              labelCol={{ flex: `0 0 ${connectionFormLabelWidth[language]}` }}
              wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }}
              disabled={busy}
              onValuesChange={() => setStatus(undefined)}
            >
              <Form.Item name="type" hidden>
                <Input />
              </Form.Item>
              <Tabs
                styles={{ header: { height: 36, margin: '0 0 12px' }, item: { height: 36, padding: 0 } }}
                activeKey={section}
                onChange={setSection}
                items={[
                  {
                    key: 'general',
                    label: t('常规'),
                    forceRender: true,
                    children: (
                      <div className="connection-fields">
                        <Form.Item name="name" label={t('连接名称')} rules={[{ required: true, whitespace: true, message: t('请输入连接名称') }]}>
                          <Input placeholder={t('例如：本地开发库')} />
                        </Form.Item>
                        <Form.Item name="group" label={t('连接分组')} getValueProps={(value?: string) => ({ value: value ? connectionGroupLabel(value, t) : value })}>
                          <AutoComplete
                            placeholder={t('输入或选择分组，留空归入默认分组')}
                            options={groups.map((group) => ({ value: group, label: connectionGroupLabel(group, t) }))}
                            onSelect={(group) => form.setFieldValue('group', group)}
                            filterOption={(input, option) => {
                              const value = String(option?.value ?? '')
                              const keyword = input.toLowerCase()
                              return (
                                input === connectionGroupLabel(connectionGroupName(connection?.group), t) ||
                                value.toLowerCase().includes(keyword) ||
                                connectionGroupLabel(value, t).toLowerCase().includes(keyword)
                              )
                            }}
                            allowClear
                          />
                        </Form.Item>
                        {redis && (
                          <Form.Item name="redisMode" label={t('连接模式')}>
                            <Select options={Object.entries(redisModeLabels).map(([value, label]) => ({ value, label: t(label) }))} onChange={selectRedisMode} />
                          </Form.Item>
                        )}
                        <Form.Item name="host" label={t(sentinel ? '哨兵主机' : '主机地址')} rules={[{ required: true, whitespace: true, message: t('主机地址不能为空，请输入 IP 或域名') }]}>
                          <Input placeholder="127.0.0.1" />
                        </Form.Item>
                        <Form.Item name="port" label={t('端口')} rules={[{ required: true, message: t('请输入端口') }]}>
                          <InputNumber placeholder={t('端口')} min={1} max={65535} style={{ width: '100%' }} />
                        </Form.Item>
                        {redis && redisMode !== 'standalone' && (
                          <Form.Item name="redisNodesText" label={t(sentinel ? '其他哨兵' : '其他集群节点')} extra={t('每行一个地址，格式为主机:端口')}>
                            <Input.TextArea rows={2} placeholder={sentinel ? '127.0.0.1:26380' : '127.0.0.1:6380'} />
                          </Form.Item>
                        )}
                        {sentinel && (
                          <>
                            <Form.Item name="redisMasterName" label={t('主节点名称')} rules={[{ required: true, whitespace: true, message: t('请输入 Redis 哨兵监控的主节点名称') }]}>
                              <Input placeholder="mymaster" />
                            </Form.Item>
                            <Form.Item name="redisSentinelUsername" label={t('哨兵用户名')}>
                              <Input autoComplete="off" placeholder={t('可留空，使用 default 用户')} />
                            </Form.Item>
                            <Form.Item name="redisSentinelPassword" label={t('哨兵密码')} extra={connection?.hasRedisSentinelPassword ? t('留空保留原密码') : undefined}>
                              <Input.Password autoComplete="new-password" placeholder={t(connection?.hasRedisSentinelPassword ? '已保存，留空不修改' : '未启用认证时可留空')} />
                            </Form.Item>
                          </>
                        )}
                        {engine.database !== undefined && engine.value !== DatabaseEngine.Redis && (
                          <Form.Item
                            name="database"
                            label={t('维护数据库')}
                            rules={[{ required: true, whitespace: true, message: t('请输入可连接的数据库') }]}
                            extra={t('用于测试连接和读取数据库列表；查询可在顶部切换数据库')}
                          >
                            <Input placeholder={engine.database} />
                          </Form.Item>
                        )}
                        <Form.Item
                          name="username"
                          label={t(sentinel ? 'Redis 用户名' : '用户名')}
                          rules={engine.optionalUsername ? [] : [{ required: true, whitespace: true, message: t('请输入用户名') }]}
                        >
                          <Input autoComplete="username" placeholder={t(engine.value === DatabaseEngine.Redis ? '可留空，使用 default 用户' : '请输入数据库用户名')} />
                        </Form.Item>
                        <Form.Item name="password" label={t(sentinel ? 'Redis 密码' : '密码')} extra={connection?.hasPassword ? t('留空保留原密码') : undefined}>
                          <Input.Password autoComplete="new-password" placeholder={connection?.hasPassword ? t('已保存，留空不修改') : t('数据库密码')} />
                        </Form.Item>
                      </div>
                    )
                  },
                  {
                    key: 'ssl',
                    label: 'SSL',
                    forceRender: true,
                    children: (
                      <div className="connection-fields">
                        <Form.Item name="tls" label="SSL / TLS" valuePropName="checked" extra={t('验证服务器证书及主机名')}>
                          <Switch />
                        </Form.Item>
                      </div>
                    )
                  }
                ]}
              />
            </Form>
          </div>
          {(testing || status) && (
            <div className="connection-test-result" style={{ flex: 'none', minWidth: 0, maxHeight: '35%', overflowY: 'auto' }}>
              {!testing && status?.type === 'error' ? (
                <ErrorNotice title={t('连接失败')} error={status.message} onClose={() => setStatus(undefined)} />
              ) : (
                <Alert
                  showIcon
                  role="status"
                  type={testing ? 'info' : 'success'}
                  icon={testing ? <LoadingOutlined /> : undefined}
                  title={testing ? t('正在测试连接…') : t('连接成功：{value1}', { value1: status?.message ?? '' })}
                  style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
