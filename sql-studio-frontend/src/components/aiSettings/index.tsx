import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Empty, Flex, Spin, theme, Tooltip, Typography } from 'antd'

import { aiProviders } from '@/ai'
import { maxAIConfigurations } from '@/ai/typings'
import type { useAISettings } from '@/hooks/useAISettings'
import type { ThemeMode } from '@/typings/theme'

import AIProviderIcon from '../aiProviderIcon'
import ModelEditor from './components/modelEditor'
import { useModelEditor } from './hooks/useModelEditor'

interface Props {
  themeMode: ThemeMode
  model: ReturnType<typeof useAISettings>
  disabled: boolean
}

export default function AISettings({ themeMode, model, disabled }: Props) {
  const { token } = theme.useToken()
  const editor = useModelEditor(model.entries, model.upsertEntry)
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
              <AIProviderIcon provider={entry.provider} themeMode={themeMode} />
              <Tooltip title={`${aiProviders.find((provider) => provider.value === entry.provider)?.label} ${entry.modelName}`}>
                <Typography.Text ellipsis style={{ flex: 1, minWidth: 0 }}>
                  {aiProviders.find((provider) => provider.value === entry.provider)?.label} {entry.modelName}
                </Typography.Text>
              </Tooltip>
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
              <Tooltip title="移除模型">
                <Button type="text" danger icon={<DeleteOutlined />} aria-label={`移除模型 ${entry.model}`} disabled={locked} onClick={() => model.removeEntry(entry.id)} />
              </Tooltip>
            </Flex>
          ))}
          {!model.entries.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还未添加模型" />}
        </Flex>
      </Spin>
      <ModelEditor editor={editor} themeMode={themeMode} />
    </Flex>
  )
}
