import { CaretRightOutlined, ClearOutlined, PauseOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Checkbox, Empty, Flex, Input, Switch, theme, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'

import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'
import { getChannels, subscribe } from '@/services/redis'
import type { RedisChannel, RedisChannels } from '@/services/redis'

import { objectTreeLayout, redisPanelLayout } from '../../../../constant/layout'
import CountBadge from '../../../countBadge'
import ToolbarButton from '../../../toolbarButton'

type Message = { id: number; channel: string; payload: string; truncated?: boolean; receivedAt: number }

export default function PubSub({ id, active }: { id: string; active: boolean }) {
  const { t, language } = useTranslation()
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
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState('')
  usePageError(active ? channelError : undefined)
  usePageError(active ? subscriptionError : undefined)
  const stream = useRef<AbortController | null>(null)
  const counter = useRef(0)
  const log = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const buffer = useRef<Message[]>([])

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
    if (autoScroll && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, autoScroll])

  function stop() {
    stream.current?.abort()
    stream.current = null
    setStatus('idle')
    pausedRef.current = false
    setPaused(false)
    buffer.current = []
    setRequest((previous) => ({ ...previous }))
  }

  async function start() {
    if (!channel.trim() || stream.current) return
    const controller = new AbortController()
    stream.current = controller
    setStatus('connecting')
    setMessages([])
    buffer.current = []
    pausedRef.current = false
    setPaused(false)
    setSubscriptionError('')
    try {
      await subscribe(id, channel, pattern, controller.signal, (event) => {
        if (controller.signal.aborted) return
        if (event.type === 'ready') {
          setStatus('ready')
          setRequest((previous) => ({ ...previous }))
        } else {
          const message = { ...event, id: ++counter.current, receivedAt: Date.now() }
          if (pausedRef.current) {
            buffer.current = [...buffer.current.slice(-99), message]
            return
          }
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

  function togglePause() {
    if (paused) {
      pausedRef.current = false
      setPaused(false)
      const pending = buffer.current
      buffer.current = []
      if (pending.length) setMessages((previous) => [...previous, ...pending].slice(-100))
    } else {
      pausedRef.current = true
      setPaused(true)
    }
  }

  function clearMessages() {
    buffer.current = []
    setMessages([])
  }

  function chooseChannel(item: RedisChannel) {
    if (status !== 'idle') return
    setSelectedChannel(item.ref)
    setChannel(item.name)
    setPattern(false)
  }

  const timeLabel = (time: number) => new Date(time).toLocaleTimeString(language, { hour12: false }) + '.' + String(new Date(time).getMilliseconds()).padStart(3, '0')
  const statusText = status === 'ready' ? t('正在接收消息') : status === 'connecting' ? t('正在订阅…') : t('尚未订阅')

  return (
    <Flex vertical style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          flex: 'none',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer
        }}
      >
        <Typography.Text type="secondary">{t('频道或模式')}</Typography.Text>
        <Input
          value={channel}
          disabled={status !== 'idle'}
          placeholder={t(pattern ? '输入频道模式，例如 news:*' : '输入频道名称，例如 news:updates')}
          aria-label={t('频道或模式')}
          maxLength={256}
          onChange={(event) => {
            setChannel(event.target.value)
            setSelectedChannel('')
          }}
          style={{ flex: '1 1 220px', maxWidth: 420, minWidth: 180 }}
        />
        <Checkbox checked={pattern} disabled={status !== 'idle'} onChange={(event) => setPattern(event.target.checked)}>
          {t('按模式订阅')}
        </Checkbox>
        {status === 'idle' ? (
          <Button disabled={!channel.trim()} onClick={() => void start()}>
            {t('开始订阅')}
          </Button>
        ) : (
          <Button danger onClick={stop}>
            {t('停止订阅')}
          </Button>
        )}
        <Typography.Text type={status === 'ready' ? 'success' : 'secondary'} aria-live="polite">
          {statusText}
        </Typography.Text>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          aria-label={t('活跃频道')}
          style={{
            display: 'flex',
            flex: 'none',
            flexDirection: 'column',
            width: redisPanelLayout.sidebarWidth,
            minHeight: 0,
            borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer
          }}
        >
          <div style={{ display: 'flex', flex: 'none', alignItems: 'center', gap: 7, height: redisPanelLayout.headerHeight, paddingInline: 16, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Typography.Text strong>{t('活跃频道')}</Typography.Text>
            <CountBadge count={channels?.channels.length ?? 0} />
            {channels?.truncated && (
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t('仅显示部分内容')}
              </Typography.Text>
            )}
            <Flex gap={token.marginXXS} style={{ marginInlineStart: 'auto' }}>
              <ToolbarButton icon={<ReloadOutlined />} label={t('刷新')} loading={loading} onClick={() => setRequest({ pattern: filter })} />
            </Flex>
          </div>
          <div style={{ display: 'flex', flex: 'none', gap: 6, padding: '10px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Input
              value={filter}
              aria-label={t('筛选频道')}
              placeholder={t('匹配模式，可留空')}
              maxLength={256}
              onChange={(event) => setFilter(event.target.value)}
              onPressEnter={() => setRequest({ pattern: filter })}
            />
            <ToolbarButton icon={<SearchOutlined />} label={t('筛选')} onClick={() => setRequest({ pattern: filter })} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 0 8px' }}>
            {loading && !channels ? (
              <Typography.Text type="secondary" style={{ display: 'block', padding: '16px 8px' }}>
                {t('正在读取频道…')}
              </Typography.Text>
            ) : channels?.channels.length ? (
              channels.channels.map((item) => (
                <Button
                  key={item.ref}
                  type="text"
                  block
                  disabled={status !== 'idle'}
                  onClick={() => chooseChannel(item)}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 8,
                    height: objectTreeLayout.rowHeight,
                    paddingInline: 16,
                    lineHeight: `${objectTreeLayout.rowHeight}px`,
                    borderRadius: token.borderRadius,
                    background: selectedChannel === item.ref ? token.controlItemBgActive : undefined,
                    textAlign: 'start'
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span style={{ flex: 'none', color: token.colorTextSecondary, fontVariantNumeric: 'tabular-nums' }}>{item.subscribers}</span>
                </Button>
              ))
            ) : (
              <div style={{ display: 'grid', height: '100%', placeItems: 'center' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('没有匹配的频道')} />
              </div>
            )}
          </div>
        </aside>

        <section style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div style={{ display: 'flex', flex: 'none', alignItems: 'center', gap: 8, height: redisPanelLayout.headerHeight, paddingInline: 16, borderBottom: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}>
            <Typography.Text strong>{t('消息流')}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('{value1} 条', { value1: messages.length })}
            </Typography.Text>
            <Flex align="center" gap={8} style={{ marginInlineStart: 'auto' }}>
              <Flex align="center" gap={6}>
                <Typography.Text type="secondary">{t('自动滚动')}</Typography.Text>
                <Switch size="small" checked={autoScroll} onChange={setAutoScroll} aria-label={t('自动滚动')} />
              </Flex>
              <Flex gap={token.marginXXS}>
                <ToolbarButton icon={paused ? <CaretRightOutlined /> : <PauseOutlined />} label={paused ? t('继续接收消息') : t('暂停消息')} disabled={status === 'idle'} onClick={togglePause} />
                <ToolbarButton icon={<ClearOutlined />} label={t('清空消息')} disabled={!messages.length} onClick={clearMessages} />
              </Flex>
            </Flex>
          </div>
          <div ref={log} role="log" aria-label={t('订阅消息')} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '2px 0', background: token.colorBgLayout }}>
            {messages.length ? (
              messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '82px 112px minmax(0, 1fr)',
                    alignItems: 'baseline',
                    gap: 10,
                    padding: '8px 16px',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`
                  }}
                >
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, fontVariantNumeric: 'tabular-nums' }}>
                    {timeLabel(message.receivedAt)}
                  </Typography.Text>
                  <Typography.Text ellipsis>{message.channel}</Typography.Text>
                  <Typography.Text style={{ minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                    {message.payload || '""'}
                    {message.truncated && ` · ${t('仅显示部分内容')}`}
                  </Typography.Text>
                </div>
              ))
            ) : (
              <div style={{ display: 'grid', height: '100%', placeItems: 'center', padding: 24 }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(status === 'idle' ? '尚未接收消息' : '正在等待消息…')} />
              </div>
            )}
          </div>
        </section>
      </div>
    </Flex>
  )
}
