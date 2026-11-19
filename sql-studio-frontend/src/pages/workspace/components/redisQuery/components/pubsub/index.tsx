import { ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Checkbox, Flex, Form, Input, Table, theme, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'

import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'
import { getChannels, subscribe } from '@/services/redis'
import type { RedisChannel, RedisChannels } from '@/services/redis'

import ToolbarButton from '../../../toolbarButton'

type Message = { id: number; channel: string; payload: string; truncated?: boolean }

export default function PubSub({ id, active }: { id: string; active: boolean }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [filter, setFilter] = useState('')
  const [request, setRequest] = useState({ pattern: '' })
  const [channels, setChannels] = useState<RedisChannels>()
  const [channelError, setChannelError] = useState('')
  const [loading, setLoading] = useState(false)
  const [channel, setChannel] = useState('')
  const [pattern, setPattern] = useState(false)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready'>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [subscriptionError, setSubscriptionError] = useState('')
  usePageError(active ? channelError : undefined)
  usePageError(active ? subscriptionError : undefined)
  const stream = useRef<AbortController | null>(null)
  const counter = useRef(0)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setChannelError('')
    void getChannels(id, request.pattern, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setChannels(value)
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setChannelError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id, request])

  useEffect(() => () => stream.current?.abort(), [])
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages])

  function stop() {
    stream.current?.abort()
    stream.current = null
    setStatus('idle')
    setRequest((previous) => ({ ...previous }))
  }

  async function start() {
    if (!channel.trim() || stream.current) return
    const controller = new AbortController()
    stream.current = controller
    setStatus('connecting')
    setMessages([])
    setSubscriptionError('')
    try {
      await subscribe(id, channel, pattern, controller.signal, (event) => {
        if (controller.signal.aborted) return
        if (event.type === 'ready') {
          setStatus('ready')
          setRequest((previous) => ({ ...previous }))
        } else {
          const message = { ...event, id: ++counter.current }
          setMessages((previous) => [...previous.slice(-99), message])
        }
      })
    } catch (error) {
      if (!controller.signal.aborted) setSubscriptionError(error instanceof Error ? error.message : String(error))
    } finally {
      if (stream.current === controller) {
        stream.current = null
        setStatus('idle')
        setRequest((previous) => ({ ...previous }))
      }
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: token.marginMD, alignItems: 'start' }}>
      <Card size="small" title={t('活跃频道')} style={{ minWidth: 0 }}>
        <Flex vertical gap="small">
          <Flex gap="small">
            <Input
              value={filter}
              aria-label={t('筛选频道')}
              placeholder={t('匹配模式，可留空')}
              maxLength={256}
              onChange={(event) => setFilter(event.target.value)}
              onPressEnter={() => setRequest({ pattern: filter })}
            />
            <ToolbarButton label={t('刷新')} icon={<ReloadOutlined />} loading={loading} onClick={() => setRequest({ pattern: filter })} />
          </Flex>
          {channels && (
            <Typography.Text type="secondary">
              {t('模式订阅数')} · {channels.patterns}
              {channels.truncated && ` · ${t('仅显示部分内容')}`}
            </Typography.Text>
          )}
          <Table
            size="small"
            rowKey={(item: RedisChannel) => item.ref}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            dataSource={channels?.channels ?? []}
            columns={[
              { title: t('频道'), dataIndex: 'name', ellipsis: true },
              { title: t('订阅者'), dataIndex: 'subscribers', align: 'right', width: 100 }
            ]}
          />
        </Flex>
      </Card>
      <Card size="small" title={t('实时订阅')} style={{ minWidth: 0 }}>
        <Flex vertical gap="small">
          <Form layout="horizontal" labelCol={{ flex: '112px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }}>
            <Form.Item label={t('频道或模式')} htmlFor="redis-channel" style={{ marginBottom: token.marginSM }}>
              <Input
                id="redis-channel"
                placeholder={t(pattern ? '输入频道模式，例如 news:*' : '输入频道名称，例如 news:updates')}
                value={channel}
                maxLength={256}
                disabled={status !== 'idle'}
                onChange={(event) => setChannel(event.target.value)}
              />
            </Form.Item>
            <Form.Item label={t('订阅方式')} style={{ marginBottom: 0 }}>
              <Checkbox checked={pattern} disabled={status !== 'idle'} onChange={(event) => setPattern(event.target.checked)}>
                {t('按模式订阅')}
              </Checkbox>
            </Form.Item>
          </Form>
          <Flex align="center" justify="space-between" gap="small" wrap>
            <Typography.Text aria-live="polite" type="secondary">
              {t(status === 'ready' ? '正在接收消息' : status === 'connecting' ? '正在订阅…' : '尚未订阅')}
            </Typography.Text>
            {status === 'idle' ? (
              <Button disabled={!channel.trim()} onClick={() => void start()}>
                {t('开始订阅')}
              </Button>
            ) : (
              <Button onClick={stop}>{t('停止订阅')}</Button>
            )}
          </Flex>
          <Flex vertical gap="small" role="log" aria-label={t('订阅消息')} ref={log} style={{ maxHeight: 360, overflow: 'auto' }}>
            {messages.map((message) => (
              <div key={message.id} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                <Typography.Text strong>{message.channel}</Typography.Text>
                <div>{message.payload || '""'}</div>
                {message.truncated && <Typography.Text type="secondary">{t('仅显示部分内容')}</Typography.Text>}
              </div>
            ))}
          </Flex>
        </Flex>
      </Card>
    </div>
  )
}
