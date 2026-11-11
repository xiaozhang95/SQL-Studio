import { DeleteOutlined, KeyOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Flex, Form, Input, Select, Space, Tooltip } from 'antd'
import { useEffect, useEffectEvent } from 'react'

import { aiProviders } from '@/ai'
import type { AIProviderType } from '@/ai/typings'
import { useAISettings } from '@/hooks/useAISettings'
import type { ThemeMode } from '@/typings/theme'

import AIProviderIcon from '../aiProviderIcon'

export default function AISettings({ themeMode, onDone, onBusyChange }: { themeMode: ThemeMode; onDone: () => void; onBusyChange: (busy: boolean) => void }) {
  const model = useAISettings()
  const initialize = useEffectEvent(model.show)
  useEffect(() => {
    void initialize()
  }, [])
  useEffect(() => {
    onBusyChange(model.busy)
  }, [model.busy, onBusyChange])
  useEffect(() => () => onBusyChange(false), [onBusyChange])
  return (
    <>
      {model.error && <Alert type="error" showIcon title={model.error} style={{ marginBottom: 16 }} />}
      <Form layout="horizontal" labelCol={{ flex: '72px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} labelAlign="right" labelWrap disabled={!model.ready || model.loading || model.busy}>
        <Form.Item label="服务商" style={{ marginBottom: 12 }}>
          <Select<AIProviderType>
            aria-label="AI 服务商"
            value={model.provider}
            options={aiProviders.map((profile) => ({
              value: profile.value,
              label: (
                <Space>
                  <AIProviderIcon provider={profile.value} themeMode={themeMode} />
                  {profile.label}
                </Space>
              )
            }))}
          />
        </Form.Item>
        <Form.Item label="API Key" required={!model.configured} style={{ marginBottom: 12 }}>
          <Input.Password
            prefix={<KeyOutlined />}
            value={model.apiKey}
            onChange={(event) => model.changeKey(event.target.value)}
            placeholder={model.configured ? '已保存，留空保留' : '请输入 API Key'}
            autoComplete="new-password"
            aria-label="API Key"
          />
        </Form.Item>
        <Form.Item
          label="模型"
          style={{ marginBottom: 12 }}
          validateStatus={model.modelsError ? 'error' : undefined}
          help={model.modelsError ? <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{model.modelsError}</span> : undefined}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Select<string>
              aria-label="AI 模型"
              value={model.models.length ? model.model : undefined}
              placeholder="加载并选择模型"
              onChange={model.setModel}
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
            <Tooltip title="加载模型列表">
              <Button
                icon={<ReloadOutlined />}
                aria-label="加载模型列表"
                loading={model.modelsLoading}
                disabled={!model.ready || model.busy || model.loading || (!model.configured && !model.apiKey.trim())}
                onClick={() => void model.refreshModels()}
              />
            </Tooltip>
          </Space.Compact>
        </Form.Item>
      </Form>
      <Flex justify="space-between" align="center" gap="small" wrap>
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={!model.ready || !model.configured || model.loading || model.saving}
          loading={model.removing}
          onClick={async () => {
            if (await model.remove()) onDone()
          }}
        >
          移除配置
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={model.saving}
          disabled={model.removing || !model.ready || model.loading || model.modelsLoading || !model.models.some((item) => item.id === model.model) || (!model.configured && !model.apiKey.trim())}
          onClick={async () => {
            if (await model.save()) onDone()
          }}
        >
          保存配置
        </Button>
      </Flex>
    </>
  )
}
