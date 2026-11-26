import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Empty, Flex, Radio, Spin, theme, Tooltip, Typography } from 'antd'
import { useId } from 'react'

import { maxAIConfigurations } from '@/ai/typings'
import DeleteConfirmation from '@/components/deleteConfirmation'
import type { useAISettings } from '@/hooks/useAISettings'
import { useTranslation } from '@/hooks/useTranslation'

import AIProviderIcon from '../aiProviderIcon'
import ModelEditor from './components/modelEditor'
import { useModelEditor } from './hooks/useModelEditor'

interface Props {
  model: ReturnType<typeof useAISettings>
  disabled: boolean
}

export default function AISettings({ model, disabled }: Props) {
  const { t } = useTranslation()

  const { token } = theme.useToken()
  const editor = useModelEditor(model.entries, model.upsertEntry)
  const defaultModelGroup = useId()
  const locked = disabled || !model.ready || model.loading || model.busy
  return (
    <Flex vertical>
      <Typography.Text strong style={{ display: 'block', marginBottom: 9 }}>
        {t('已添加模型')}
      </Typography.Text>
      <Spin spinning={model.loading}>
        <Flex vertical gap="small" role="list" aria-label={t('已添加模型')}>
          {model.entries.map((entry) => {
            const isDefault = model.activeId === entry.id
            const test = model.connectionTests[entry.id]
            const testStatus = t(test?.loading ? '正在测试连接…' : (test?.message ?? ''))
            const testLabel = t('测试连接 {value1}', { value1: entry.modelName })
            return (
              <Flex
                key={entry.id}
                role="listitem"
                align="center"
                style={{
                  minWidth: 0,
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: token.borderRadiusLG,
                  border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 30,
                    height: 30,
                    flex: 'none',
                    border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadiusLG,
                    background: token.colorBgElevated
                  }}
                >
                  <AIProviderIcon provider={entry.provider} size={18} />
                </span>
                <Flex vertical gap={1} style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="center" gap={6} style={{ minWidth: 0 }}>
                    <Typography.Text strong ellipsis={{ tooltip: entry.modelName }}>
                      {entry.modelName}
                    </Typography.Text>
                  </Flex>
                  <Typography.Text type="secondary" ellipsis={{ tooltip: entry.model }}>
                    {entry.model}
                  </Typography.Text>
                </Flex>
                <Flex align="center" gap={4} style={{ flexShrink: 0 }}>
                  <Radio
                    name={defaultModelGroup}
                    checked={isDefault}
                    disabled={locked}
                    aria-label={t('默认模型 {value1}', { value1: entry.modelName })}
                    onChange={() => model.selectActive(entry.id)}
                  >
                    {isDefault ? t('默认') : t('设为默认')}
                  </Radio>
                  <Tooltip title={testStatus || t('测试连接')} trigger={['hover', 'focus']}>
                    <Button
                      type="text"
                      icon={test?.success === true ? <CheckCircleOutlined /> : test?.success === false ? <CloseCircleOutlined /> : <LinkOutlined />}
                      aria-label={testStatus ? `${testLabel} · ${testStatus}` : testLabel}
                      loading={test?.loading}
                      disabled={locked}
                      danger={test?.success === false}
                      style={test?.success === true ? { color: token.colorSuccessText } : undefined}
                      onClick={() => void model.testConnection(entry.id)}
                    />
                  </Tooltip>
                  <Tooltip title={t('编辑模型')}>
                    <Button type="text" icon={<EditOutlined />} aria-label={t('编辑模型 {value1}', { value1: entry.model })} disabled={locked} onClick={() => editor.show(entry)} />
                  </Tooltip>
                  <DeleteConfirmation
                    title={t('删除这个模型？')}
                    description={<span style={{ overflowWrap: 'anywhere' }}>{t('「{name}」将在保存设置后删除。', { name: entry.modelName })}</span>}
                    disabled={locked}
                    onConfirm={() => model.removeEntry(entry.id)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('删除模型 {value1}', { value1: entry.modelName })} title={t('删除模型')} disabled={locked} />
                  </DeleteConfirmation>
                </Flex>
              </Flex>
            )
          })}
          {!model.entries.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('还未添加模型')} />}
        </Flex>
      </Spin>
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        disabled={locked || model.entries.length >= maxAIConfigurations}
        onClick={() => editor.show()}
        style={{ alignSelf: 'flex-start', marginTop: token.marginXS }}
      >
        {t('添加模型')}
      </Button>
      <ModelEditor editor={editor} />
    </Flex>
  )
}
