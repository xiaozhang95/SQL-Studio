import { Alert, Button, Form, Input, Modal, Select, Space } from 'antd'
import type { FormInstance } from 'antd'

import type { AIStatus, AIUpdate } from '../../../../typings/settings'
import { DeepSeekLogo } from '../deepseekLogo'

interface Props {
  open: boolean
  busy: boolean
  error: string
  status: AIStatus | null
  form: FormInstance<AIUpdate>
  onClose: () => void
  onSave: (v: AIUpdate) => Promise<void>
  onClear: () => Promise<void>
}
export function ModelSettings({ open, busy, error, status, form, onClose, onSave, onClear }: Props) {
  return (
    <Modal
      title={
        <Space size="small">
          <DeepSeekLogo />
          DeepSeek 设置
        </Space>
      }
      width={440}
      open={open}
      onCancel={onClose}
      maskClosable={!busy}
      closable={!busy}
      forceRender
      footer={
        <Space>
          <Button type="text" danger disabled={!status?.configured || busy} onClick={() => void onClear()}>
            清除 Key
          </Button>
          <Button onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button type="primary" loading={busy} disabled={!status} onClick={() => form.submit()}>
            保存
          </Button>
        </Space>
      }
    >
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{
          flex: '72px',
          xs: { flex: '72px' },
          style: { textAlign: 'right', paddingBottom: 0 }
        }}
        wrapperCol={{
          flex: '1 1 0',
          xs: { flex: '1 1 0' },
          style: { minWidth: 0 }
        }}
        colon={false}
        onFinish={onSave}
        disabled={busy || !status}
      >
        <Form.Item
          label="API Key"
          name="apiKey"
          rules={[
            {
              required: !status?.configured,
              whitespace: true,
              message: '请输入 API Key'
            }
          ]}
          extra={status?.configured ? '已保存，留空保留原 Key。' : '仅在本机后端加密保存。'}
        >
          <Input.Password aria-label="API Key" autoComplete="off" placeholder={status?.configured ? '输入新 Key 可替换' : '输入 DeepSeek API Key'} maxLength={512} />
        </Form.Item>
        <Form.Item label="模型" name="model" rules={[{ required: true, message: '请选择模型' }]}>
          <Select
            aria-label="模型"
            placeholder="选择 DeepSeek 模型"
            options={status?.models.map((m) => ({
              value: m.id,
              label: m.name
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
