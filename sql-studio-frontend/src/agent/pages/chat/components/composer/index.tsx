import { ArrowUpOutlined, KeyOutlined, StopOutlined } from '@ant-design/icons'
import { Sender } from '@ant-design/x'
import { Button, Divider, Flex, Form, Select, Tag, theme, Tooltip } from 'antd'
import type { FormInstance } from 'antd'
import { useState } from 'react'

import type { TokenUsage } from '../../../../typings/chat'
import type { AIStatus } from '../../../../typings/settings'
import { shouldSendOnEnter } from '../../../../utils/inputSubmission'
import { CHAT } from '../../constant/chat'
import { DeepSeekLogo } from '../deepseekLogo'

interface Props {
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
export function Composer({ form, busy, settingsBusy, aiStatus, onSend, onStop, onConfigure, onModelChange, onDraftChange, usage }: Props) {
  const [modelOpen, setModelOpen] = useState(false)
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
              <Tooltip title={usage ? `1M上下文；实测输入 ${usage.promptTokens || '—'} token；保守预算上界 ${usage.estimatedTokens ?? '—'}，非精确tokenizer` : '仅执行只读查询'}>
                <Tag color="blue">只读模式</Tag>
              </Tooltip>
              <Flex align="center" gap="small">
                <Select
                  aria-label="当前模型"
                  variant="borderless"
                  prefix={<DeepSeekLogo />}
                  value={aiStatus?.model}
                  open={modelOpen}
                  onOpenChange={setModelOpen}
                  options={aiStatus?.models.map((m) => ({
                    value: m.id,
                    label: m.name,
                    disabled: !aiStatus.configured
                  }))}
                  optionRender={(option) => (
                    <Flex align="center" gap="small">
                      <DeepSeekLogo />
                      <span>{option.label}</span>
                    </Flex>
                  )}
                  onChange={(id) => {
                    setModelOpen(false)
                    void onModelChange(id)
                  }}
                  disabled={busy || settingsBusy || !aiStatus}
                  popupRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ marginBlock: token.marginXXS }} />
                      <Button
                        block
                        type="text"
                        icon={
                          <Flex align="center" justify="center" style={{ width: 24 }}>
                            <KeyOutlined />
                          </Flex>
                        }
                        style={{ justifyContent: 'flex-start', paddingInline: token.paddingSM, gap: token.marginXS }}
                        onClick={() => {
                          setModelOpen(false)
                          onConfigure()
                        }}
                      >
                        DeepSeek 配置
                      </Button>
                    </>
                  )}
                  popupMatchSelectWidth
                  style={{ minWidth: CHAT.modelSelectorWidth }}
                />
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
