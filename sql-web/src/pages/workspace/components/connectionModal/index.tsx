import { CheckCircleOutlined, LinkOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, AutoComplete, Button, Form, Input, InputNumber, Modal, Switch, Tabs, Tag, Tooltip } from 'antd'

import type { Connection } from '@/typings/database'

import { useConnectionForm } from '../../hooks/useConnectionForm'
import EngineIcon from '../engineIcon'

type Props = { open: boolean; connection?: Connection; connections: Connection[]; onClose: () => void; onSaved: (connection: Connection) => void }

export default function ConnectionModal({ open, connection, connections, onClose, onSaved }: Props) {
  const { form, groups, saving, testing, status, section, engine, busy, setStatus, setSection, test, save } = useConnectionForm({ open, connection, connections, onSaved })
  return (
    <Modal
      className="connection-dialog"
      centered
      styles={{
        container: { padding: 0, overflow: 'hidden', background: 'var(--surface)' },
        header: { margin: 0, padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' },
        body: { padding: 0 },
        footer: { margin: 0, padding: '16px 24px', borderTop: '1px solid var(--border)' }
      }}
      width={960}
      title={connection ? '编辑连接' : '新建连接'}
      open={open}
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      maskClosable={!busy}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (!visible) {
          setStatus(undefined)
          setSection('general')
        }
      }}
      footer={
        <div className="modal-footer">
          <Button icon={<LinkOutlined />} onClick={test} loading={testing} disabled={saving}>
            测试连接
          </Button>
          <div className="modal-actions">
            <Button onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button type="primary" onClick={save} loading={saving} disabled={testing}>
              保存连接
            </Button>
          </div>
        </div>
      }
    >
      <div className="connection-dialog-body">
        <aside className="engine-picker">
          <div className="engine-picker-heading">数据库类型</div>
          <div className="engine-option is-selected" style={{ cursor: 'default' }}>
            <EngineIcon type={engine.value} variant="logo" />
            <span className="engine-option-label">{engine.label}</span>
          </div>
        </aside>
        <div className="connection-settings" style={{ background: 'var(--surface)' }}>
          <div className={`connection-engine-header ${engine.className}`}>
            <EngineIcon type={engine.value} variant="logo" />
            <strong>{engine.label}</strong>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Tag color="blue">默认端口 {engine.port}</Tag>
              <Tooltip title="连接凭据仅加密保存在当前电脑">
                <Tag color="success" icon={<SafetyCertificateOutlined />}>
                  本地加密
                </Tag>
              </Tooltip>
            </div>
          </div>
          <Form form={form} layout="horizontal" labelCol={{ flex: '96px' }} wrapperCol={{ flex: 'auto' }} disabled={busy} onValuesChange={() => setStatus(undefined)}>
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
                    <div className="connection-fields">
                      <Form.Item name="name" label="连接名称" rules={[{ required: true, whitespace: true, message: '请输入连接名称' }]}>
                        <Input placeholder="例如：本地开发库" />
                      </Form.Item>
                      <Form.Item name="group" label="连接分组">
                        <AutoComplete
                          placeholder="输入或选择分组，留空归入默认分组"
                          options={groups.map((group) => ({ value: group }))}
                          filterOption={(input, option) => Boolean(option?.value.toLowerCase().includes(input.toLowerCase()))}
                          allowClear
                        />
                      </Form.Item>
                      <Form.Item name="host" label="主机地址" rules={[{ required: true, whitespace: true, message: '主机地址不能为空，请输入 IP 或域名' }]}>
                        <Input placeholder="127.0.0.1" />
                      </Form.Item>
                      <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
                        <InputNumber placeholder="端口" min={1} max={65535} style={{ width: '100%' }} />
                      </Form.Item>
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
                    <div className="connection-fields">
                      <Form.Item name="tls" label="SSL / TLS" valuePropName="checked" extra="验证服务器证书及主机名">
                        <Switch />
                      </Form.Item>
                    </div>
                  )
                }
              ]}
            />
          </Form>
          {status &&
            (status.type === 'error' ? (
              <Alert className="connection-test-result" showIcon type="error" title="连接失败" description={status.message} />
            ) : (
              <div className="connection-test-result test-success" role="status">
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  连接成功
                </Tag>
                <Tooltip title={status.message}>
                  <span>{status.message}</span>
                </Tooltip>
              </div>
            ))}
        </div>
      </div>
    </Modal>
  )
}
