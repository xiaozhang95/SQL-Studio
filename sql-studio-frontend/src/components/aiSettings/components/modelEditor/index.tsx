import { KeyOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Form, Input, Modal, Select, Space, Tooltip } from 'antd'

import { aiProviders } from '@/ai'
import type { AIProviderType } from '@/ai/typings'
import ErrorNotice from '@/components/errorNotice'

import AIProviderIcon from '../../../aiProviderIcon'
import type { useModelEditor } from '../../hooks/useModelEditor'

export default function ModelEditor({ editor }: { editor: ReturnType<typeof useModelEditor> }) {
  const { draft } = editor
  return (
    <Modal
      title={editor.editing ? '编辑模型' : '添加模型'}
      open={Boolean(draft)}
      onCancel={editor.close}
      onOk={editor.commit}
      okText={editor.editing ? '应用' : '添加'}
      okButtonProps={{ disabled: !editor.canCommit }}
      destroyOnHidden
    >
      {draft && (
        <>
          <ErrorNotice error={editor.error} style={{ marginBottom: 16 }} />
          <Form layout="horizontal" labelCol={{ flex: '96px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} labelAlign="right">
            <Form.Item label="供应商" required>
              <Select<AIProviderType>
                aria-label="模型供应商"
                value={draft.provider}
                placeholder="请选择供应商"
                onChange={editor.changeProvider}
                options={aiProviders.map((provider) => ({
                  value: provider.value,
                  label: (
                    <Space>
                      <AIProviderIcon provider={provider.value} />
                      {provider.label}
                    </Space>
                  )
                }))}
              />
            </Form.Item>
            <Form.Item label="API Key" required={!draft.configured}>
              <Input.Password
                aria-label="API Key"
                prefix={<KeyOutlined />}
                autoComplete="new-password"
                value={draft.apiKey}
                disabled={!draft.provider}
                placeholder={draft.configured ? '已保存，留空保留' : '请输入 API Key'}
                onChange={(event) => editor.changeKey(event.target.value)}
              />
            </Form.Item>
            <Form.Item
              label="模型"
              required
              validateStatus={draft.modelsError || editor.duplicate ? 'error' : undefined}
              help={draft.modelsError ? <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{draft.modelsError}</span> : editor.duplicate ? '该供应商的此模型已添加' : undefined}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Select<string>
                  aria-label="模型名称"
                  value={draft.model || undefined}
                  placeholder="加载并选择模型"
                  loading={draft.modelsLoading}
                  disabled={draft.modelsLoading || !draft.models.length}
                  onChange={editor.changeModel}
                  style={{ flex: 1, minWidth: 0 }}
                  options={draft.models.map((model) => ({
                    value: model.id,
                    label: editor.usedModels.includes(model.id) ? `${model.name}（已添加）` : model.name,
                    disabled: editor.usedModels.includes(model.id)
                  }))}
                />
                <Tooltip title="刷新模型列表">
                  <Button
                    icon={<ReloadOutlined />}
                    aria-label="刷新模型列表"
                    loading={draft.modelsLoading}
                    disabled={!draft.provider || (!draft.configured && !draft.apiKey.trim())}
                    onClick={() => void editor.refreshModels()}
                  />
                </Tooltip>
              </Space.Compact>
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  )
}
