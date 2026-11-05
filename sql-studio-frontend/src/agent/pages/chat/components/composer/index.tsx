import { CheckOutlined, DownOutlined, EditOutlined, InfoCircleOutlined, LockOutlined } from '@ant-design/icons'
import { Sender } from '@ant-design/x'
import { Alert, Button, Dropdown, Flex, Form, theme, Tooltip } from 'antd'
import type { FormInstance } from 'antd'

import type { TokenUsage } from '../../../../typings/chat'
import type { AIStatus } from '../../../../typings/settings'
import { shouldSendOnEnter } from '../../../../utils/inputSubmission'
import { CHAT } from '../../constant/chat'
import { useComposerResize } from '../../hooks/composerResize'
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
  onModelChange: (id: string) => Promise<void>
  onDraftChange: (_: unknown, v: { question?: string }) => void
  usage: TokenUsage | null
}
export function Composer({ mode, onModeChange, form, busy, settingsBusy, aiStatus, onSend, onStop, onModelChange, onDraftChange, usage }: Props) {
  const { token } = theme.useToken()
  const { container: containerRef, height, minimum, maximum, resizer } = useComposerResize()
  const question = Form.useWatch('question', form) ?? ''
  const tooLong = new TextEncoder().encode(question).length > CHAT.maxQuestionBytes
  function submit(text: string) {
    if (!busy && !settingsBusy && aiStatus?.configured && text.trim() && new TextEncoder().encode(text).length <= CHAT.maxQuestionBytes) void onSend({ question: text })
  }
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        className="composer-resizer"
        role="separator"
        aria-label="调整聊天输入框高度"
        aria-orientation="horizontal"
        aria-valuemin={minimum}
        aria-valuemax={maximum}
        aria-valuenow={height}
        tabIndex={0}
        {...resizer}
        style={{
          position: 'absolute',
          insetInline: 0,
          top: -CHAT.composerResize.handleHeight,
          height: CHAT.composerResize.handleHeight,
          cursor: 'row-resize',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ width: token.controlHeight, height: token.lineWidth * 2, borderRadius: token.borderRadius, background: token.colorTextQuaternary }} />
      </div>
      <Form form={form} component={false} onValuesChange={onDraftChange}>
        <Form.Item name="question" noStyle>
          <Sender
            classNames={{ root: 'chat-sender', content: 'chat-sender-content', input: 'chat-sender-input', footer: 'chat-sender-footer' }}
            styles={{
              root: { height, display: 'flex', flexDirection: 'column' },
              content: height === undefined ? undefined : { flex: 1, minHeight: 0 },
              input: height === undefined ? undefined : { height: '100%', overflowY: 'auto' }
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
            autoSize={height === undefined ? CHAT.composerRows : false}
            placeholder="向数据库提问…（Enter 发送，Shift+Enter 换行）"
            footer={
              <Flex align="center" justify="space-between" gap="small" wrap>
                <Flex align="center" gap={token.marginXXS}>
                  <Dropdown
                    trigger={['click']}
                    placement="topLeft"
                    menu={{
                      selectable: false,
                      items: [
                        {
                          key: 'readonly',
                          icon: <LockOutlined />,
                          label: (
                            <Flex align="center" justify="space-between" gap="middle" style={{ minWidth: token.controlHeight * 4 }}>
                              <span>只读模式</span>
                              <span style={{ width: token.fontSize, display: 'inline-flex', justifyContent: 'center' }}>{mode === 'readonly' && <CheckOutlined />}</span>
                            </Flex>
                          )
                        },
                        {
                          key: 'write',
                          icon: <EditOutlined />,
                          label: (
                            <Flex align="center" justify="space-between" gap="middle" style={{ minWidth: token.controlHeight * 4 }}>
                              <span>完全访问模式</span>
                              <span style={{ width: token.fontSize, display: 'inline-flex', justifyContent: 'center' }}>{mode === 'write' && <CheckOutlined />}</span>
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
                      className={mode === 'write' ? 'chat-mode-write' : undefined}
                    >
                      {mode === 'write' ? '完全访问模式' : '只读模式'}
                      <DownOutlined aria-hidden="true" className="dropdown-chevron" />
                    </Button>
                  </Dropdown>
                  <Tooltip
                    title={`只读模式仅查询；完全访问模式可修改数据及结构，执行前逐次确认，操作可能不可撤销。删除和清空始终禁止执行。${usage ? ` 1M上下文 · 输入 ${usage.promptTokens || '—'} token` : ''}`}
                  >
                    <Button type="text" size="small" aria-label="模式说明" icon={<InfoCircleOutlined className="chat-mode-hint" />} />
                  </Tooltip>
                </Flex>
                <Flex align="center" gap={token.marginXS}>
                  <Dropdown
                    trigger={['click']}
                    placement="topRight"
                    menu={{
                      selectedKeys: aiStatus ? [aiStatus.model] : [],
                      items: [...(aiStatus?.models.map((m) => ({ key: m.id, label: m.name, icon: <DeepSeekLogo size={CHAT.modelMenuIconSize} />, disabled: !aiStatus.configured })) ?? [])],
                      onClick: ({ key }) => {
                        void onModelChange(key)
                      }
                    }}
                  >
                    <Button
                      type="text"
                      aria-label="当前模型"
                      disabled={busy || settingsBusy || !aiStatus?.configured}
                      title={!aiStatus?.configured ? '请在右上角系统设置中配置 DeepSeek API' : undefined}
                      icon={<DeepSeekLogo size={CHAT.modelTriggerIconSize} />}
                      style={{ paddingInline: token.paddingXS }}
                    >
                      {aiStatus?.models.find((m) => m.id === aiStatus.model)?.name ?? 'DeepSeek'}
                      <DownOutlined aria-hidden="true" className="dropdown-chevron" />
                    </Button>
                  </Dropdown>
                  {busy ? (
                    <Tooltip title="终止生成">
                      <Button
                        type="primary"
                        danger
                        shape="circle"
                        aria-label="停止生成"
                        icon={
                          <span aria-hidden="true" style={{ display: 'block', width: token.fontSizeSM, height: token.fontSizeSM, background: 'currentColor', borderRadius: token.borderRadiusXS }} />
                        }
                        onClick={onStop}
                      />
                    </Tooltip>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => submit(question)}
                      aria-label="发送消息"
                      shape="circle"
                      icon={
                        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M21.4 3.2 3.2 10.6a.9.9 0 0 0 .1 1.7l6.8 2.2 6.2-6.2a.6.6 0 0 1 .8.8l-6.2 6.2 2.2 6.8a.9.9 0 0 0 1.7.1l7.4-18.2a.7.7 0 0 0-.8-.8Z" />
                        </svg>
                      }
                      disabled={settingsBusy || !aiStatus?.configured || tooLong}
                    />
                  )}
                </Flex>
              </Flex>
            }
          />
        </Form.Item>
      </Form>
      {tooLong && <Alert type="warning" showIcon title="消息超过 256 KiB，请缩短内容或分段发送。" style={{ marginTop: token.marginXS }} />}
    </div>
  )
}
