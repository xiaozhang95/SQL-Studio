import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Modal, Select, Space, Switch } from 'antd'

import { getAIAdapter } from '@/ai'
import type { ThemeMode } from '@/typings/theme'

import { useAISettings } from '../../hooks/useAISettings'
import AIProviderIcon from '../aiProviderIcon'

export default function AISettings({ themeMode }: { themeMode: ThemeMode }) {
  const model = useAISettings()
  return (
    <>
      <Button icon={<AIProviderIcon provider={model.provider} themeMode={themeMode} />} onClick={() => void model.show()}>
        {getAIAdapter(model.provider).profile.label}
      </Button>
      <Modal
        title="DeepSeek 配置"
        open={model.open}
        onCancel={model.close}
        onOk={() => void model.save()}
        okText="保存"
        cancelText="取消"
        confirmLoading={model.saving}
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space>
            <CancelBtn />
            <Button danger disabled={!model.ready || !model.configured || model.loading || model.saving} loading={model.removing} onClick={() => void model.remove()}>
              移除配置
            </Button>
            <OkBtn />
          </Space>
        )}
        cancelButtonProps={{ disabled: model.busy }}
        closable={!model.busy}
        mask={{ closable: !model.busy }}
        keyboard={!model.busy}
        okButtonProps={{
          disabled: model.removing || !model.ready || model.loading || model.modelsLoading || !model.models.some((item) => item.id === model.model) || (!model.configured && !model.apiKey.trim())
        }}
      >
        {model.error && <Alert type="error" title={model.error} style={{ marginBottom: 16 }} />}
        <Form layout="horizontal" labelCol={{ flex: '80px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} labelAlign="right" labelWrap disabled={model.loading || model.busy}>
          <Form.Item label="API Key" required={!model.configured}>
            <Input.Password
              value={model.apiKey}
              onChange={(event) => model.changeKey(event.target.value)}
              placeholder={model.configured ? '已配置 API Key' : '请输入 API Key'}
              autoComplete="new-password"
              aria-label="API Key"
            />
          </Form.Item>
          <Form.Item
            label="模型"
            validateStatus={model.modelsError ? 'error' : undefined}
            help={model.modelsError ? <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{model.modelsError}</span> : undefined}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Select
                value={model.models.length ? model.model : undefined}
                onChange={model.setModel}
                aria-label="AI 模型"
                placeholder="请选择模型"
                loading={model.modelsLoading}
                disabled={model.loading || model.busy || model.modelsLoading || !model.models.length}
                style={{ flex: 1, minWidth: 0 }}
                options={model.models.map((item) => ({
                  value: item.id,
                  label: (
                    <Space>
                      <AIProviderIcon provider={model.provider} themeMode={themeMode} />
                      {item.name}
                    </Space>
                  )
                }))}
              />
              <Button
                icon={<ReloadOutlined />}
                loading={model.modelsLoading}
                disabled={model.busy || model.loading || (!model.configured && !model.apiKey.trim())}
                onClick={() => void model.refreshModels()}
                aria-label="获取模型"
                title="获取模型"
              />
            </Space.Compact>
          </Form.Item>
          <Form.Item label="代码补全">
            <Switch checked={model.completionEnabled} onChange={model.setCompletionEnabled} aria-label="代码补全" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
