import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Empty, Flex, Popconfirm, Radio, Spin, theme, Tooltip, Typography } from 'antd'
import { useId } from 'react'

import { getAIAdapter } from '@/ai'
import { maxAIConfigurations } from '@/ai/typings'
import type { useAISettings } from '@/hooks/useAISettings'

import AIProviderIcon from '../aiProviderIcon'
import ModelEditor from './components/modelEditor'
import { useModelEditor } from './hooks/useModelEditor'

interface Props {
  model: ReturnType<typeof useAISettings>
  disabled: boolean
}

export default function AISettings({ model, disabled }: Props) {
  const { token } = theme.useToken()
  const editor = useModelEditor(model.entries, model.upsertEntry)
  const defaultModelGroup = useId()
  const locked = disabled || !model.ready || model.loading || model.busy
  return (
    <Flex vertical gap="middle">
      <Flex justify="flex-end">
        <Button icon={<PlusOutlined />} disabled={locked || model.entries.length >= maxAIConfigurations} onClick={() => editor.show()}>
          添加模型
        </Button>
      </Flex>
      <Spin spinning={model.loading}>
        <Flex vertical gap="small" role="list" aria-label="已添加模型">
          {model.entries.map((entry) => (
            <Flex
              key={entry.id}
              role="listitem"
              align="center"
              gap="small"
              style={{ minWidth: 0, padding: token.paddingSM, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, background: token.colorFillAlter }}
            >
              <AIProviderIcon provider={entry.provider} size={token.controlHeight} />
              <Flex vertical gap={token.marginXXS} style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong ellipsis={{ tooltip: entry.modelName }}>
                  {entry.modelName}
                </Typography.Text>
                <Typography.Text type="secondary">{getAIAdapter(entry.provider).profile.label}</Typography.Text>
              </Flex>
              <Radio name={defaultModelGroup} checked={model.activeId === entry.id} disabled={locked} aria-label={`默认模型 ${entry.modelName}`} onChange={() => model.selectActive(entry.id)}>
                默认
              </Radio>
              <Tooltip title={model.connectionTests[entry.id]?.message || '测试连接'}>
                <Button
                  type="text"
                  icon={model.connectionTests[entry.id]?.success === true ? <CheckCircleOutlined /> : model.connectionTests[entry.id]?.success === false ? <CloseCircleOutlined /> : <LinkOutlined />}
                  aria-label={`测试连接 ${entry.modelName}`}
                  loading={model.connectionTests[entry.id]?.loading}
                  disabled={locked}
                  style={{ color: model.connectionTests[entry.id]?.success === true ? token.colorSuccess : model.connectionTests[entry.id]?.success === false ? token.colorError : undefined }}
                  onClick={() => void model.testConnection(entry.id)}
                />
              </Tooltip>
              <Tooltip title="编辑模型">
                <Button type="text" icon={<EditOutlined />} aria-label={`编辑模型 ${entry.model}`} disabled={locked} onClick={() => editor.show(entry)} />
              </Tooltip>
              <Popconfirm
                okType="default"
                title="删除这个模型？"
                description={<span style={{ overflowWrap: 'anywhere' }}>「{entry.modelName}」将在保存设置后删除。</span>}
                okText="删除"
                cancelText="取消"
                disabled={locked}
                onConfirm={() => model.removeEntry(entry.id)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除模型 ${entry.modelName}`} title="删除模型" disabled={locked} />
              </Popconfirm>
            </Flex>
          ))}
          {!model.entries.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还未添加模型" />}
        </Flex>
      </Spin>
      <ModelEditor editor={editor} />
    </Flex>
  )
}
