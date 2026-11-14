import { CopyOutlined, DeleteOutlined, EditOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, Flex, Form, Input, InputNumber, Modal, Tag, theme, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import { changeKey, getKey, scanKeys } from '@/services/redis'
import type { RedisKey, RedisKeyChange, RedisKeyDetail, RedisKeyPage } from '@/services/redis'

import ToolbarButton from '../../../toolbarButton'

type Action = RedisKeyChange['action']

export default function KeyBrowser({ id, database }: { id: string; database: number }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [filter, setFilter] = useState('')
  const [request, setRequest] = useState({ pattern: '', cursor: '0' })
  const [page, setPage] = useState<RedisKeyPage>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<RedisKey>()
  const [detail, setDetail] = useState<RedisKeyDetail>()
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const detailRequest = useRef<AbortController | null>(null)
  const selectedRef = useRef<string | undefined>(undefined)
  const mutation = useRef<AbortController | null>(null)
  const [action, setAction] = useState<Action>()
  const [target, setTarget] = useState('')
  const [value, setValue] = useState('')
  const [ttl, setTTL] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)
  const [changeError, setChangeError] = useState('')
  const [form] = Form.useForm()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void scanKeys(id, database, request.pattern, request.cursor, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setPage(value)
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id, database, request])

  useEffect(
    () => () => {
      detailRequest.current?.abort()
      mutation.current?.abort()
    },
    []
  )

  function scan(pattern: string, cursor = '0') {
    setPage(undefined)
    setRequest({ pattern, cursor })
    detailRequest.current?.abort()
    selectedRef.current = undefined
    setSelected(undefined)
    setDetail(undefined)
    setDetailError('')
    setDetailLoading(false)
  }

  function read(key: RedisKey, refresh = false) {
    if (mutation.current || (!refresh && selectedRef.current === key.ref)) return
    selectedRef.current = key.ref
    detailRequest.current?.abort()
    const controller = new AbortController()
    detailRequest.current = controller
    setSelected(key)
    setDetail(undefined)
    setDetailError('')
    setDetailLoading(true)
    void getKey(id, database, key.ref, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setDetail(value)
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setDetailError(reason.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false)
      })
  }

  function promptAction(next: Action) {
    if (!selected || !detail) return
    setTarget(next === 'copy' ? selected.name + ':copy' : selected.name)
    setValue(detail.preview)
    setTTL(detail.ttlMillis < 0 ? 0 : Math.max(1, Math.ceil(detail.ttlMillis / 1000)))
    setChangeError('')
    setAction(next)
  }

  async function save() {
    if (!selected || !detail || !action || mutation.current) return
    let change: RedisKeyChange
    switch (action) {
      case 'ttl':
        if (ttl === null) return
        change = { action, ttl }
        break
      case 'copy':
      case 'rename':
        change = { action, target }
        break
      case 'value':
        change = { action, value, before: detail.preview }
        break
      case 'delete':
        change = { action }
        break
    }
    const controller = new AbortController()
    mutation.current = controller
    setSaving(true)
    setChangeError('')
    try {
      await changeKey(id, database, selected.ref, change, controller.signal)
      if (controller.signal.aborted) return
      mutation.current = null
      setAction(undefined)
      if (action === 'value' || action === 'ttl') read(selected, true)
      else scan(request.pattern)
    } catch (reason) {
      if (!controller.signal.aborted) setChangeError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (!controller.signal.aborted) {
        mutation.current = null
        setSaving(false)
      }
    }
  }

  const actionTitle = { copy: '复制键', rename: '重命名键', value: '编辑键值', ttl: '编辑 TTL', delete: '删除键' } as const
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: token.marginMD, alignItems: 'start' }}>
      <Card size="small" title={t('键列表')} style={{ minWidth: 0 }}>
        <Flex vertical gap="small">
          <Flex gap="small">
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onPressEnter={() => scan(filter)}
              placeholder={t('按模式匹配键，例如 user:*')}
              aria-label={t('筛选 Redis 键')}
              maxLength={256}
            />
            <Button icon={<SearchOutlined />} loading={loading} onClick={() => scan(filter)}>
              {t('筛选')}
            </Button>
            <Button icon={<ReloadOutlined />} aria-label={t('刷新')} disabled={loading} onClick={() => scan(request.pattern)} />
          </Flex>
          <ErrorNotice error={error ? t(error) : undefined} />
          {page && (
            <>
              <Flex vertical gap={2} style={{ maxHeight: 450, overflow: 'auto' }}>
                {[...new Map(page.keys.map((key) => [key.ref, key])).values()].map((key) => (
                  <Button key={key.ref} className="redis-key-choice" type="text" aria-pressed={selected?.ref === key.ref} block onClick={() => read(key)} style={{ justifyContent: 'flex-start' }}>
                    <Typography.Text ellipsis title={key.name}>
                      {key.name || '""'}
                    </Typography.Text>
                  </Button>
                ))}
                {!page.keys.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(page.cursor === '0' ? '没有匹配的键' : '当前扫描页没有匹配的键')} />}
              </Flex>
              {page.cursor !== '0' && <Button onClick={() => scan(request.pattern, page.cursor)}>{t('扫描下一页')}</Button>}
            </>
          )}
        </Flex>
      </Card>
      <Card
        size="small"
        title={t('键详情')}
        loading={detailLoading}
        style={{ minWidth: 0 }}
        extra={
          selected && (
            <Flex gap={2}>
              <ToolbarButton size="small" icon={<CopyOutlined />} label={t('复制键')} disabled={!detail} onClick={() => promptAction('copy')} />
              <ToolbarButton size="small" icon={<EditOutlined />} label={t('重命名键')} disabled={!detail} onClick={() => promptAction('rename')} />
              <ToolbarButton size="small" icon={<DeleteOutlined />} label={t('删除键')} danger disabled={!detail} onClick={() => promptAction('delete')} />
              <ToolbarButton size="small" icon={<ReloadOutlined />} label={t('刷新键详情')} onClick={() => read(selected, true)} />
            </Flex>
          )
        }
      >
        <ErrorNotice error={detailError ? t(detailError) : undefined} />
        {!selected && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('选择一个键查看详情')} />}
        {detail && selected && (
          <Flex vertical gap="small">
            <Descriptions
              size="small"
              column={1}
              styles={{ label: { whiteSpace: 'nowrap' }, content: { minWidth: 0, overflowWrap: 'anywhere' } }}
              items={[
                { key: 'name', label: t('键名'), children: selected.name || '""' },
                { key: 'type', label: t('类型'), children: <Tag>{detail.type}</Tag> },
                {
                  key: 'ttl',
                  label: 'TTL',
                  children: (
                    <Flex gap="small" align="center">
                      <Typography.Text>{detail.ttlMillis < 0 ? t('永久有效') : `${(detail.ttlMillis / 1000).toLocaleString()} s`}</Typography.Text>
                      <ToolbarButton size="small" icon={<EditOutlined />} label={t('编辑 TTL')} onClick={() => promptAction('ttl')} />
                    </Flex>
                  )
                },
                ...(detail.size >= 0 ? [{ key: 'size', label: t(detail.type === 'string' ? '字节数' : '元素数量'), children: detail.size.toLocaleString() }] : [])
              ]}
            />
            {detail.editable && (
              <Flex justify="end">
                <ToolbarButton size="small" icon={<EditOutlined />} label={t('编辑键值')} onClick={() => promptAction('value')} />
              </Flex>
            )}
            {detail.truncated && <Typography.Text type="secondary">{t('仅显示部分内容')}</Typography.Text>}
            <Input.TextArea aria-label={t('键值预览')} rows={8} readOnly value={detail.preview} />
          </Flex>
        )}
      </Card>
      <Modal
        title={action ? t(actionTitle[action]) : undefined}
        open={Boolean(action)}
        onCancel={() => setAction(undefined)}
        onOk={() => void save()}
        confirmLoading={saving}
        closable={!saving}
        maskClosable={!saving}
        keyboard={!saving}
        cancelButtonProps={{ disabled: saving }}
        okButtonProps={{ danger: action === 'delete', disabled: action === 'ttl' && ttl === null }}
        okText={t(action === 'delete' ? '删除' : '保存')}
      >
        <Typography.Paragraph>{action === 'delete' ? t('确定删除 Redis 键「{value1}」？', { value1: selected?.name ?? '' }) : selected?.name}</Typography.Paragraph>
        <ErrorNotice error={changeError ? t(changeError) : undefined} />
        {action !== 'delete' && (
          <Form form={form} layout="horizontal" labelCol={{ flex: '92px' }} wrapperCol={{ flex: '1 1 0' }} disabled={saving}>
            {(action === 'copy' || action === 'rename') && (
              <Form.Item label={t('目标键名')} htmlFor="redis-key-target">
                <Input id="redis-key-target" maxLength={16384} value={target} spellCheck={false} onChange={(event) => setTarget(event.target.value)} />
              </Form.Item>
            )}
            {action === 'value' && (
              <Form.Item label={t('键值')} htmlFor="redis-key-value">
                <Input.TextArea id="redis-key-value" maxLength={16384} value={value} rows={8} spellCheck={false} onChange={(event) => setValue(event.target.value)} />
              </Form.Item>
            )}
            {action === 'ttl' && (
              <Form.Item label={t('TTL 秒数')} htmlFor="redis-key-ttl" extra={t('填 0 设为永久有效')}>
                <InputNumber id="redis-key-ttl" min={0} max={315360000} precision={0} value={ttl} onChange={setTTL} style={{ width: '100%' }} />
              </Form.Item>
            )}
          </Form>
        )}
      </Modal>
    </div>
  )
}
