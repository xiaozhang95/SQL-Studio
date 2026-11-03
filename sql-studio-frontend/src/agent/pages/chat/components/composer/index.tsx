import { ArrowUpOutlined, KeyOutlined, StopOutlined } from '@ant-design/icons'
import { Sender } from '@ant-design/x'
import { Button, Divider, Flex, Form, Select, Tag, Tooltip } from 'antd'
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
  const question = Form.useWatch('question', form) ?? ''
  function submit(text: string) {
    if (!busy && !settingsBusy && aiStatus?.configured && text.trim() && text.length <= CHAT.maxQuestionLength) void onSend({ question: text })
  }
  return (
    <>
      <Form form={form} component={false}>
        <Form.Item name="question" hidden>
          <input />
        </Form.Item>
      </Form>
      <Sender
        aria-label="消息"
        value={question}
        onChange={(value) => {
          const draft = value.slice(0, CHAT.maxQuestionLength)
          form.setFieldValue('question', draft)
          onDraftChange(null, { question: draft })
        }}
        onSubmit={submit}
        onCancel={onStop}
        readOnly={busy}
        loading={busy}
        submitType="enter"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !shouldSendOnEnter(event.nativeEvent)) return false
        }}
        suffix={false}
        autoSize={{ minRows: 2, maxRows: 6 }}
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
                onChange={(id) => {
                  setModelOpen(false)
                  void onModelChange(id)
                }}
                disabled={busy || settingsBusy || !aiStatus}
                popupRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ marginBlock: 4 }} />
                    <Button
                      block
                      type="text"
                      icon={<KeyOutlined />}
                      onClick={() => {
                        setModelOpen(false)
                        onConfigure()
                      }}
                    >
                      配置 API Key
                    </Button>
                  </>
                )}
                popupMatchSelectWidth={false}
                style={{ minWidth: 176 }}
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
    </>
  )
}
