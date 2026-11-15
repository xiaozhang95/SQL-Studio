import { CopyOutlined, DeleteOutlined, EditOutlined, FormOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, Flex, Form, Input, InputNumber, Modal, Tag, theme, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import { changeKey, getKey, getKeyTTL, scanKeys } from '@/services/redis'
import type { RedisKey, RedisKeyChange, RedisKeyDetail, RedisKeyPage } from '@/services/redis'

import ToolbarButton from '../../../toolbarButton'

type Action = RedisKeyChange['action']
const actionTitle = { create: '新增键', copy: '复制键', rename: '重命名键', value: '编辑键', ttl: '编辑 TTL', delete: '删除键' } as const
const ttlRefreshMs = 1000

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
  const [remainingTTL, setRemainingTTL] = useState(-1)
  const expiring = remainingTTL >= 0
  const detailRequest = useRef<AbortController | null>(null)
  const selectedRef = useRef<string | undefined>(undefined)
  const mutation = useRef<AbortController | null>(null)
  const [action, setAction] = useState<Action>()
  const [target, setTarget] = useState('')
  const [value, setValue] = useState('')
  const [ttl, setTTL] = useState<number | null>(0)
  const [ttlEdited, setTTLEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changeError, setChangeError] = useState('')
  const [form] = Form.useForm()

  const clearMissingKey = useCallback((ref: string) => {
    if (selectedRef.current !== ref) return
    selectedRef.current = undefined
    setSelected(undefined)
    setDetail(undefined)
    setDetailError('')
    setPage((previous) => previous && { ...previous, keys: previous.keys.filter((key) => key.ref !== ref) })
    setAction((current) => (current === 'create' ? current : undefined))
  }, [])

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

  useEffect(() => {
    if (!selected || !detail || !expiring || saving) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refreshTTL(ref: string) {
      try {
        const { ttlMillis } = await getKeyTTL(id, database, ref, controller.signal)
        if (controller.signal.aborted || mutation.current || selectedRef.current !== ref) return
        setRemainingTTL(ttlMillis)
        setDetailError('')
        if (ttlMillis === -2) clearMissingKey(ref)
        if (ttlMillis < 0) return
      } catch (reason) {
        if (controller.signal.aborted || mutation.current || selectedRef.current !== ref) return
        setDetailError(reason instanceof Error ? reason.message : String(reason))
      }
      timer = setTimeout(() => void refreshTTL(ref), ttlRefreshMs)
    }
    timer = setTimeout(() => void refreshTTL(selected.ref), ttlRefreshMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [id, database, selected, detail, expiring, saving, clearMissingKey])

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
        if (!controller.signal.aborted) {
          setDetail(value)
          setRemainingTTL(value.ttlMillis)
        }
      })
      .catch((reason: Error) => {
        if (controller.signal.aborted) return
        if (t(reason.message) === t('Redis 键已不存在')) clearMissingKey(key.ref)
        else setDetailError(reason.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false)
      })
  }

  function promptAction(next: Action) {
    if (next !== 'create' && (!selected || !detail)) return
    const name = detail?.name ?? selected?.name ?? ''
    setTarget(next === 'create' ? '' : next === 'copy' ? name + ':copy' : name)
    setValue(next === 'create' ? '' : (detail?.preview ?? ''))
    setTTL(next === 'create' || remainingTTL < 0 ? 0 : Math.max(1, Math.ceil(remainingTTL / 1000)))
    setTTLEdited(false)
    setChangeError('')
    setAction(next)
  }

  async function save() {
    if (!action || mutation.current || (action !== 'create' && (!selected || !detail))) return
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
        if (!detail || ttl === null) return
        change = { action, value, before: detail.preview, target: detail.name !== undefined && target !== detail.name ? target : undefined, ttl: ttlEdited ? ttl : undefined }
        break
      case 'create':
        if (!target || ttl === null) return
        change = { action, target, value, ttl }
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
      const result = await changeKey(id, database, action === 'create' ? undefined : selected?.ref, change, controller.signal)
      if (controller.signal.aborted) return
      mutation.current = null
      setAction(undefined)
      if (result.key) {
        setRequest({ pattern: request.pattern, cursor: '0' })
        read(result.key, true)
      } else if (selected && (action === 'value' || action === 'ttl')) read(selected, true)
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: token.marginMD, alignItems: 'start' }}>
      <Card size="small" title={t('键列表')} style={{ minWidth: 0 }} extra={<ToolbarButton size="small" icon={<PlusOutlined />} label={t('新增键')} onClick={() => promptAction('create')} />}>
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
            <ToolbarButton icon={<ReloadOutlined />} label={t('刷新')} disabled={loading} onClick={() => scan(request.pattern)} />
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
              <ToolbarButton
                size="small"
                icon={<EditOutlined />}
                label={t('编辑键')}
                disabled={!detail?.editable}
                hint={detail && !detail.editable ? t('当前键值类型或大小不支持直接编辑') : undefined}
                onClick={() => promptAction('value')}
              />
              <ToolbarButton size="small" icon={<FormOutlined />} label={t('重命名键')} disabled={!detail} onClick={() => promptAction('rename')} />
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
              column={2}
              styles={{ root: { tableLayout: 'fixed' }, label: { whiteSpace: 'nowrap' }, content: { minWidth: 0, overflowWrap: 'anywhere' } }}
              items={[
                { key: 'name', label: t('键名'), children: (detail.name ?? selected.name) || '""' },
                { key: 'type', label: t('类型'), children: <Tag>{detail.type}</Tag> },
                {
                  key: 'ttl',
                  label: 'TTL',
                  children: (
                    <Flex gap="small" align="center">
                      <Typography.Text style={{ whiteSpace: 'nowrap' }}>{expiring ? `${Math.ceil(remainingTTL / 1000).toLocaleString()} ${t('秒')}` : t('永久有效')}</Typography.Text>
                      <ToolbarButton size="small" icon={<EditOutlined />} label={t('编辑 TTL')} onClick={() => promptAction('ttl')} />
                    </Flex>
                  )
                },
                ...(detail.size >= 0 ? [{ key: 'size', label: t(detail.type === 'string' ? '字节数' : '元素数量'), children: detail.size.toLocaleString() }] : [])
              ]}
            />
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
        okButtonProps={{ danger: action === 'delete', disabled: (action === 'create' && !target) || ((action === 'create' || action === 'value' || action === 'ttl') && ttl === null) }}
        okText={t(action === 'delete' ? '删除' : '保存')}
      >
        {action === 'delete' && <Typography.Paragraph>{t('确定删除 Redis 键「{value1}」？', { value1: selected?.name ?? '' })}</Typography.Paragraph>}
        <ErrorNotice error={changeError ? t(changeError) : undefined} />
        {action !== 'delete' && (
          <Form form={form} layout="horizontal" labelCol={{ flex: '92px' }} wrapperCol={{ flex: '1 1 0' }} disabled={saving}>
            {(action === 'create' || action === 'value' || action === 'copy' || action === 'rename') && (
              <Form.Item label={t(action === 'create' || action === 'value' ? '键名' : '目标键名')} htmlFor="redis-key-target">
                <Input
                  id="redis-key-target"
                  placeholder={t(action === 'create' || action === 'value' ? '输入键名' : '输入目标键名')}
                  maxLength={16384}
                  disabled={action === 'value' && detail?.name === undefined}
                  value={target}
                  spellCheck={false}
                  onChange={(event) => setTarget(event.target.value)}
                />
              </Form.Item>
            )}
            {(action === 'create' || action === 'value') && (
              <Form.Item label={t('键值')} htmlFor="redis-key-value">
                <Input.TextArea
                  id="redis-key-value"
                  placeholder={t('输入键值，可留空')}
                  maxLength={16384}
                  value={value}
                  rows={8}
                  spellCheck={false}
                  onChange={(event) => setValue(event.target.value)}
                />
              </Form.Item>
            )}
            {(action === 'create' || action === 'value' || action === 'ttl') && (
              <Form.Item label="TTL" htmlFor="redis-key-ttl" extra={t('填 0 设为永久有效')}>
                <InputNumber
                  id="redis-key-ttl"
                  placeholder={t('输入过期秒数')}
                  suffix={<Typography.Text type="secondary">{t('秒')}</Typography.Text>}
                  min={0}
                  max={315360000}
                  precision={0}
                  value={ttl}
                  onChange={(next) => {
                    setTTL(next)
                    setTTLEdited(true)
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}
          </Form>
        )}
      </Modal>
    </div>
  )
}
