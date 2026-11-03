import { ArrowUpOutlined, CheckOutlined, DownOutlined, EditOutlined, InfoCircleOutlined, KeyOutlined, LockOutlined, StopOutlined } from '@ant-design/icons'
import { Sender } from '@ant-design/x'
import { Button, Dropdown, Flex, Form, theme, Tooltip, Typography } from 'antd'
import type { FormInstance } from 'antd'

import type { TokenUsage } from '../../../../typings/chat'
import type { AIStatus } from '../../../../typings/settings'
import { shouldSendOnEnter } from '../../../../utils/inputSubmission'
import { CHAT } from '../../constant/chat'
import { DeepSeekLogo } from '../deepseekLogo'

interface Props {
  mode: 'readonly' | 'write'
  onModeChange: (mode: 'readonly' | 'write') => void
  form: FormInstance<{ question: string }>
  busy: boolean
  settingsBusy: boolean
  aiStatus: AIStatus | null
  onSend: (v: { question: string }) => Promise<void>
  onStop: () => void
  onConfigure: () => void
  onModelChange: (id: string) => Promise<void>
  onDraftChange: (_: unknown, v: { question?: string }) => void
  usage: TokenUsage | null
}
export function Composer({ mode, onModeChange, form, busy, settingsBusy, aiStatus, onSend, onStop, onConfigure, onModelChange, onDraftChange, usage }: Props) {
  const { token } = theme.useToken()
  const question = Form.useWatch('question', form) ?? ''
  function submit(text: string) {
    if (!busy && !settingsBusy && aiStatus?.configured && text.trim() && text.length <= CHAT.maxQuestionLength) void onSend({ question: text })
  }
  return (
    <Form form={form} component={false} onValuesChange={onDraftChange}>
      <Form.Item name="question" noStyle normalize={(value: string) => value.slice(0, CHAT.maxQuestionLength)}>
        <Sender
          styles={{
            root: { border: `1px solid ${token.colorBorder}`, boxShadow: 'none', background: token.colorFillQuaternary },
            content: { padding: token.padding },
            input: { border: 0, outline: 'none', boxShadow: 'none' },
            footer: { paddingInline: token.padding, paddingBottom: token.padding }
          }}
          aria-label="消息"
          onSubmit={submit}
          onCancel={onStop}
          readOnly={busy}
          loading={busy}
          submitType="enter"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            if (shouldSendOnEnter(event.nativeEvent) && !event.ctrlKey && !event.altKey && !event.metaKey) {
              event.preventDefault()
              submit(form.getFieldValue('question') ?? '')
            }
            return false
          }}
          suffix={false}
          autoSize={CHAT.composerRows}
          placeholder="向数据库提问…（Enter 发送，Shift+Enter 换行）"
          footer={
            <Flex align="center" justify="space-between" gap="small" wrap>
              <Flex align="center" gap={token.marginXXS}>
                <Dropdown
                  styles={{ root: { border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadiusLG, background: token.colorBgElevated } }}
                  trigger={['click']}
                  placement="topLeft"
                  menu={{
                    selectable: true,
                    selectedKeys: [mode],
                    items: [
                      {
                        key: 'readonly',
                        icon: <LockOutlined />,
                        label: (
                          <Flex vertical gap={token.marginXXS} style={{ paddingBlock: token.paddingXXS }}>
                            <Flex justify="space-between" gap="middle">
                              <span>只读模式</span>
                              {mode === 'readonly' && <CheckOutlined />}
                            </Flex>
                            <Typography.Text type="secondary">查询数据、查看数据库结构</Typography.Text>
                          </Flex>
                        )
                      },
                      {
                        key: 'write',
                        icon: <EditOutlined />,
                        label: (
                          <Flex vertical gap={token.marginXXS} style={{ paddingBlock: token.paddingXXS }}>
                            <Flex justify="space-between" gap="middle">
                              <span>完全访问模式</span>
                              {mode === 'write' && <CheckOutlined />}
                            </Flex>
                            <Typography.Text type="secondary">新增、修改及结构调整，逐次确认</Typography.Text>
                          </Flex>
                        )
                      }
                    ],
                    onClick: ({ key }) => {
                      if (key === 'readonly' || key === 'write') onModeChange(key)
                    }
                  }}
                >
                  <Button
                    aria-label="操作模式"
                    disabled={busy || settingsBusy}
                    icon={mode === 'write' ? <EditOutlined /> : <LockOutlined />}
                    style={mode === 'write' ? { color: token.colorWarning, borderColor: token.colorWarning } : undefined}
                  >
                    {mode === 'write' ? '完全访问模式' : '只读模式'}
                    <DownOutlined style={{ color: token.colorTextTertiary }} />
                  </Button>
                </Dropdown>
                <Tooltip
                  title={`只读模式仅查询；完全访问模式可修改数据及结构，执行前逐次确认，操作可能不可撤销。删除和清空始终禁止执行。${usage ? ` 1M上下文 · 输入 ${usage.promptTokens || '—'} token` : ''}`}
                >
                  <Button type="text" size="small" aria-label="模式说明" icon={<InfoCircleOutlined style={{ color: token.colorTextTertiary }} />} />
                </Tooltip>
              </Flex>
              <Flex align="center" gap={token.marginXS}>
                <Dropdown
                  styles={{ root: { border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadiusLG, background: token.colorBgElevated } }}
                  trigger={['click']}
                  placement="topRight"
                  menu={{
                    selectedKeys: aiStatus ? [aiStatus.model] : [],
                    items: [
                      ...(aiStatus?.models.map((m) => ({ key: m.id, label: m.name, icon: <DeepSeekLogo size={CHAT.modelMenuIconSize} />, disabled: !aiStatus.configured })) ?? []),
                      { type: 'divider' },
                      { key: 'configure', label: 'DeepSeek 配置', icon: <KeyOutlined style={{ fontSize: CHAT.modelMenuIconSize }} /> }
                    ],
                    onClick: ({ key }) => {
                      if (key === 'configure') onConfigure()
                      else void onModelChange(key)
                    }
                  }}
                >
                  <Button
                    type="text"
                    aria-label="当前模型"
                    disabled={busy || settingsBusy || !aiStatus}
                    icon={<DeepSeekLogo size={CHAT.modelTriggerIconSize} />}
                    style={{ paddingInline: token.paddingXS }}
                  >
                    {aiStatus?.models.find((m) => m.id === aiStatus.model)?.name ?? 'DeepSeek'}
                    <DownOutlined style={{ color: token.colorTextTertiary }} />
                  </Button>
                </Dropdown>
                {busy ? (
                  <Button shape="circle" aria-label="停止生成" icon={<StopOutlined />} onClick={onStop} />
                ) : (
                  <Button type="primary" onClick={() => submit(question)} aria-label="发送消息" shape="circle" icon={<ArrowUpOutlined />} disabled={settingsBusy || !aiStatus?.configured} />
                )}
              </Flex>
            </Flex>
          }
        />
      </Form.Item>
    </Form>
  )
}
