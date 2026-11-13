import { LinkOutlined, LoadingOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, AutoComplete, Button, Form, Input, InputNumber, Modal, Switch, Tabs, Tag, Tooltip } from 'antd'

import ErrorNotice from '@/components/errorNotice'
import { connectionGroupName } from '@/constant/connectionGroup'
import { databaseProfiles } from '@/databases'
import type { Connection } from '@/typings/database'

import { useConnectionForm } from '../../hooks/useConnectionForm'
import EngineIcon from '../engineIcon'

type Props = {
  open: boolean
  connection?: Connection
  groups: string[]
  onClose: () => void
  onSaved: (connection: Connection) => void
}
export default function ConnectionModal({ open, connection, groups, onClose, onSaved }: Props) {
  const { form, selectEngine, saving, testing, status, section, engine, busy, setStatus, setSection, test, save } = useConnectionForm({ open, connection, groups, onSaved })
  return (
    <Modal
      className="connection-dialog"
      width={960}
      styles={{
        container: { padding: 0, overflow: 'hidden' },
        header: { margin: 0, padding: '20px 24px', borderBottom: '1px solid var(--border)' },
        body: { padding: 0 },
        footer: { margin: 0, padding: '16px 24px', borderTop: '1px solid var(--border)' }
      }}
      title={connection ? '编辑连接' : '新建连接'}
      open={open}
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      mask={{ closable: !busy }}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (!visible) {
          setStatus(undefined)
          setSection('general')
        }
      }}
      footer={
        <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button icon={<LinkOutlined />} onClick={test} loading={testing} disabled={saving}>
            测试连接
          </Button>
          <div className="modal-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
            <Button onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button type="default" onClick={save} loading={saving} disabled={testing}>
              保存连接
            </Button>
          </div>
        </div>
      }
    >
      <div className="connection-dialog-body" style={{ display: 'flex', height: 'min(600px, calc(100dvh - 180px))', minHeight: 0, overflow: 'hidden' }}>
        <aside
          className="engine-picker"
          style={{
            width: 'clamp(160px, 30%, 280px)',
            flex: 'none',
            padding: '20px clamp(12px, 2%, 16px)',
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            gap: 4,
            overflowY: 'auto'
          }}
        >
          <div className="engine-picker-heading" style={{ paddingBottom: 8 }}>
            数据库类型
          </div>
          {databaseProfiles.map((profile) => (
            <Button
              key={profile.value}
              type="text"
              className="engine-choice"
              aria-pressed={profile.value === engine.value}
              disabled={busy || Boolean(connection && profile.value !== engine.value)}
              onClick={() => selectEngine(profile.value)}
              style={{
                height: 'auto',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                whiteSpace: 'normal',
                textAlign: 'left'
              }}
            >
              <EngineIcon type={profile.value} variant="logo" size={32} />
              <span>{profile.label}</span>
            </Button>
          ))}
        </aside>
        <div className="connection-settings" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px clamp(16px, 3%, 28px)' }}>
            <div className={`connection-engine-header ${engine.className}`} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
              <EngineIcon type={engine.value} variant="logo" />
              <span>{engine.label}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Tag>默认端口 {engine.port}</Tag>
                <Tooltip title="连接凭据仅加密保存在当前电脑">
                  <Tag color="success" icon={<SafetyCertificateOutlined />}>
                    本地加密
                  </Tag>
                </Tooltip>
              </div>
            </div>
            <Form form={form} layout="horizontal" labelCol={{ flex: '96px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} disabled={busy} onValuesChange={() => setStatus(undefined)}>
              <Form.Item name="type" hidden>
                <Input />
              </Form.Item>
              <Tabs
                activeKey={section}
                onChange={setSection}
                items={[
                  {
                    key: 'general',
                    label: '常规',
                    forceRender: true,
                    children: (
                      <div className="connection-fields" style={{ paddingTop: 8 }}>
                        <Form.Item name="name" label="连接名称" rules={[{ required: true, whitespace: true, message: '请输入连接名称' }]}>
                          <Input placeholder="例如：本地开发库" />
                        </Form.Item>
                        <Form.Item name="group" label="连接分组">
                          <AutoComplete
                            placeholder="输入或选择分组，留空归入默认分组"
                            options={groups.map((group) => ({ value: group }))}
                            filterOption={(input, option) => input === connectionGroupName(connection?.group) || Boolean(option?.value.toLowerCase().includes(input.toLowerCase()))}
                            allowClear
                          />
                        </Form.Item>
                        <Form.Item name="host" label="主机地址" rules={[{ required: true, whitespace: true, message: '主机地址不能为空，请输入 IP 或域名' }]}>
                          <Input placeholder="127.0.0.1" />
                        </Form.Item>
                        <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
                          <InputNumber placeholder="端口" min={1} max={65535} style={{ width: '100%' }} />
                        </Form.Item>
                        {engine.database !== undefined && (
                          <Form.Item
                            name="database"
                            label="维护数据库"
                            rules={[{ required: true, whitespace: true, message: '请输入可连接的数据库' }]}
                            extra="用于测试连接和读取数据库列表；查询可在顶部切换数据库"
                          >
                            <Input placeholder={engine.database} />
                          </Form.Item>
                        )}
                        <Form.Item name="username" label="用户名" rules={[{ required: true, whitespace: true, message: '请输入用户名' }]}>
                          <Input autoComplete="username" placeholder="请输入数据库用户名" />
                        </Form.Item>
                        <Form.Item name="password" label="密码" extra={connection?.hasPassword ? '留空保留原密码' : undefined}>
                          <Input.Password autoComplete="new-password" placeholder={connection?.hasPassword ? '已保存，留空不修改' : '数据库密码'} />
                        </Form.Item>
                      </div>
                    )
                  },
                  {
                    key: 'ssl',
                    label: 'SSL',
                    forceRender: true,
                    children: (
                      <div className="connection-fields" style={{ paddingTop: 8 }}>
                        <Form.Item name="tls" label="SSL / TLS" valuePropName="checked" extra="验证服务器证书及主机名">
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
                <ErrorNotice title="连接失败" error={status.message} onClose={() => setStatus(undefined)} />
              ) : (
                <Alert
                  showIcon
                  role="status"
                  type={testing ? 'info' : 'success'}
                  icon={testing ? <LoadingOutlined /> : undefined}
                  title={testing ? '正在测试连接…' : `连接成功：${status?.message}`}
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
