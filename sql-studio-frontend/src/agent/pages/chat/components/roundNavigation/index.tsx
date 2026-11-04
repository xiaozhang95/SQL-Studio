import { UnorderedListOutlined } from '@ant-design/icons'
import { Button, Flex, Popover, Select, theme, Typography } from 'antd'
import { useState } from 'react'

import { roundMarkers } from '../../../../utils/conversationRounds'
import type { ConversationRound } from '../../../../utils/conversationRounds'

interface Props {
  rounds: ConversationRound[]
  onJump: (index: number) => void
}
export function RoundNavigation({ rounds, onJump }: Props) {
  const { token } = theme.useToken()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  return (
    <Flex
      vertical
      align="center"
      gap={token.marginXXS}
      role="navigation"
      aria-label="提问导航"
      className="chat-round-navigation"
      style={{ position: 'absolute', insetInlineStart: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 2, maxHeight: '80%', width: 32 }}
    >
      <Popover
        trigger="click"
        placement="rightTop"
        open={open}
        onOpenChange={setOpen}
        content={
          <div style={{ width: 'min(320px, 75vw)' }}>
            <Typography.Paragraph>问题列表</Typography.Paragraph>
            <Select<number>
              aria-label="搜索并跳转问题"
              showSearch
              optionFilterProp="label"
              placeholder="搜索问题"
              style={{ width: '100%' }}
              value={undefined}
              options={rounds.map((round, index) => ({ value: index, label: `${index + 1}. ${round.question}` }))}
              onChange={(index) => {
                setSelected(index)
                onJump(index)
                setOpen(false)
              }}
              optionRender={(option) => (
                <div>
                  <Typography.Text ellipsis style={{ maxWidth: '100%', display: 'block' }}>
                    {option.label}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%', display: 'block' }}>
                    {rounds[Number(option.value)].summary || '暂无回答摘要'}
                  </Typography.Text>
                </div>
              )}
            />
          </div>
        }
      >
        <Button type="text" size="small" aria-label="问题列表" icon={<UnorderedListOutlined />} />
      </Popover>
      {roundMarkers(rounds.length, selected ?? 0).map((index) => (
        <Popover
          key={rounds[index].id}
          placement="right"
          mouseEnterDelay={0.15}
          content={
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelected(index)
                onJump(index)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelected(index)
                  onJump(index)
                }
              }}
              style={{ width: 'min(280px, 70vw)', cursor: 'pointer' }}
            >
              <Typography.Paragraph ellipsis={{ rows: 2 }}>
                {index + 1}. {rounds[index].question}
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ margin: 0 }}>
                {rounds[index].summary || '暂无回答摘要'}
              </Typography.Paragraph>
            </div>
          }
        >
          <button
            className="chat-round-marker"
            aria-label={`跳转问题 ${index + 1}`}

            aria-current={selected === index ? 'step' : undefined}
            onClick={() => {
              setSelected(index)
              onJump(index)
            }}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', width: 28, height: 10, padding: 0, display: 'grid', placeItems: 'center' }}
          >
            <span style={{ width: selected === index ? 22 : 12, height: 2, background: selected === index ? token.colorPrimary : token.colorTextQuaternary }} />
          </button>
        </Popover>
      ))}
    </Flex>
  )
}
