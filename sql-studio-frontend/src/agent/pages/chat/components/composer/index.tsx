import { CheckOutlined, EditOutlined, InfoCircleOutlined, LockOutlined } from '@ant-design/icons'
import { Sender } from '@ant-design/x'
import { Alert, Button, Dropdown, Flex, Form, theme, Tooltip } from 'antd'
import type { FormInstance } from 'antd'

import DropdownChevron from '@/components/dropdownChevron'
import { useTranslation } from '@/hooks/useTranslation'

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
  const { t } = useTranslation()

  const { token } = theme.useToken()
  const { container: containerRef, height, minimum, maximum, resizer } = useComposerResize()
  const question = Form.useWatch('question', form) ?? ''
  const tooLong = new TextEncoder().encode(question).length > CHAT.maxQuestionBytes
  const selectedModel = aiStatus?.configured ? aiStatus.models.find((model) => model.id === aiStatus.configId) : undefined
  function submit(text: string) {
    if (!busy && !settingsBusy && aiStatus?.configured && text.trim() && new TextEncoder().encode(text).length <= CHAT.maxQuestionBytes) void onSend({ question: text })
  }
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        className="composer-resizer"
        role="separator"
        aria-label={t('调整聊天输入框高度')}
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
            styles={{
              root: { height, display: 'flex', flexDirection: 'column' },
              content: { padding: token.padding, ...(height === undefined ? {} : { flex: 1, minHeight: 0 }) },
              input: { border: 0, outline: 'none', boxShadow: 'none', ...(height === undefined ? {} : { height: '100%', overflowY: 'auto' }) },
              footer: { paddingInline: token.padding, paddingBlockEnd: token.padding }
            }}
            aria-label={t('消息')}
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
            placeholder={t('向数据库提问…（Enter 发送，Shift+Enter 换行）')}
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
                              <span>{t('只读模式')}</span>
                              <span style={{ width: token.fontSize, display: 'inline-flex', justifyContent: 'center' }}>{mode === 'readonly' && <CheckOutlined />}</span>
                            </Flex>
                          )
                        },
                        {
                          key: 'write',
                          icon: <EditOutlined />,
                          label: (
                            <Flex align="center" justify="space-between" gap="middle" style={{ minWidth: token.controlHeight * 4 }}>
                              <span>{t('完全访问模式')}</span>
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
                      type="text"
                      aria-label={t('操作模式')}
                      disabled={busy || settingsBusy}
                      icon={mode === 'write' ? <EditOutlined /> : <LockOutlined />}
                      className={mode === 'write' ? 'chat-mode-write' : undefined}
                    >
                      {mode === 'write' ? t('完全访问模式') : t('只读模式')}
                      <DropdownChevron disabled={busy || settingsBusy} />
                    </Button>
                  </Dropdown>
                  <Tooltip
                    title={t('只读模式仅查询；完全访问模式可修改数据及结构，执行前逐次确认，操作可能不可撤销。删除和清空始终禁止执行。{value1}', {
                      value1: usage ? t(' 1M上下文 · 输入 {tokens} token', { tokens: usage.promptTokens || '—' }) : ''
                    })}
                  >
                    <Button type="text" size="small" aria-label={t('模式说明')} icon={<InfoCircleOutlined style={{ color: token.colorIcon }} />} />
                  </Tooltip>
                </Flex>
                <Flex align="center" gap={token.marginXS}>
                  <Dropdown
                    trigger={['click']}
                    placement="topRight"
                    menu={{
                      selectedKeys: aiStatus ? [aiStatus.configId] : [],
                      items: [...(aiStatus?.models.map((m) => ({ key: m.id, label: m.name, icon: <DeepSeekLogo size={CHAT.modelMenuIconSize} /> })) ?? [])],
                      onClick: ({ key }) => {
                        void onModelChange(key)
                      }
                    }}
                  >
                    <Button
                      type="text"
                      aria-label={t('当前模型')}
                      disabled={busy || settingsBusy || !aiStatus?.models.length}
                      title={!aiStatus?.models.length ? t('请在右上角系统设置中添加模型') : undefined}
                      icon={selectedModel && <DeepSeekLogo size={CHAT.modelTriggerIconSize} />}
                      style={{ paddingInline: token.paddingXS }}
                    >
                      {selectedModel?.name ?? t('请选择模型')}
                      <DropdownChevron disabled={busy || settingsBusy || !aiStatus?.models.length} />
                    </Button>
                  </Dropdown>
                  {busy ? (
                    <Tooltip title={t('终止生成')}>
                      <Button
                        {...CHAT.iconButton}
                        danger
                        aria-label={t('停止生成')}
                        icon={
                          <span aria-hidden="true" style={{ display: 'block', width: token.fontSizeSM, height: token.fontSizeSM, background: 'currentColor', borderRadius: token.borderRadiusXS }} />
                        }
                        onClick={onStop}
                      />
                    </Tooltip>
                  ) : (
                    <Button
                      {...CHAT.iconButton}
                      onClick={() => submit(question)}
                      aria-label={t('发送消息')}
                      icon={
                        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M11.1 2.6a1 1 0 0 1 1.8 0l8.3 17a1 1 0 0 1-1.2 1.4L13 18.5V9h-2v9.5L4 21a1 1 0 0 1-1.2-1.4z" />
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
      {tooLong && <Alert type="warning" showIcon title={t('消息超过 256 KiB，请缩短内容或分段发送。')} style={{ marginTop: token.marginXS }} />}
    </div>
  )
}
