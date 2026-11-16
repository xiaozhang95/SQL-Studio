import { DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Empty, Flex, Form, Input, InputNumber, Modal, theme, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import { changeKey, getKey, getKeyTTL, scanKeys } from '@/services/redis'
import type { RedisKey, RedisKeyChange, RedisKeyDetail, RedisKeyPage } from '@/services/redis'

import ToolbarButton from '../../../toolbarButton'
import KeyEditor from '../keyEditor'
import KeyTree from '../keyTree'

type Action = Extract<RedisKeyChange['action'], 'create' | 'delete'>
const actionTitle = { create: '新增键', delete: '删除键' } as const satisfies Readonly<Record<Action, string>>
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
  const [saving, setSaving] = useState(false)
  const [changeError, setChangeError] = useState('')

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
        if (!controller.signal.aborted) setPage((previous) => (request.cursor === '0' ? value : { ...value, keys: [...(previous?.keys ?? []), ...value.keys] }))
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
    if (mutation.current) return
    if (cursor === '0') setPage(undefined)
    setRequest({ pattern, cursor })
    if (cursor !== '0') return
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
    setTarget(next === 'create' ? '' : name)
    setValue(next === 'create' ? '' : (detail?.preview ?? ''))
    setTTL(0)
    setChangeError('')
    setAction(next)
  }

  async function save() {
    if (!action || mutation.current || (action !== 'create' && (!selected || !detail))) return
    let change: RedisKeyChange
    switch (action) {
      case 'create':
        if (!target || ttl === null) return
        change = { action, target, value, ttl }
        break
      case 'delete':
        change = { action }
        break
    }
    await commit(change)
  }

  async function commit(change: RedisKeyChange) {
    if (mutation.current || (change.action !== 'create' && (!selected || !detail))) return
    const controller = new AbortController()
    mutation.current = controller
    setSaving(true)
    setChangeError('')
    try {
      const result = await changeKey(id, database, change.action === 'create' ? undefined : selected?.ref, change, controller.signal)
      if (controller.signal.aborted) return
      mutation.current = null
      setAction(undefined)
      if (result.key) {
        setRequest({ pattern: request.pattern, cursor: '0' })
        read(result.key, true)
      } else if (selected && (change.action === 'value' || change.action === 'ttl')) read(selected, true)
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
      <Card
        size="small"
        title={t('键列表')}
        style={{ minWidth: 0 }}
        extra={<ToolbarButton size="small" icon={<PlusOutlined />} label={t('新增键')} disabled={saving} onClick={() => promptAction('create')} />}
      >
        <Flex vertical gap="small">
          <Flex gap="small">
            <Input
              value={filter}
              disabled={saving}
              onChange={(event) => setFilter(event.target.value)}
              onPressEnter={() => scan(filter)}
              placeholder={t('按模式匹配键，例如 user:*')}
              aria-label={t('筛选 Redis 键')}
              maxLength={256}
            />
            <ToolbarButton icon={<SearchOutlined />} label={t('筛选')} loading={loading} disabled={saving} onClick={() => scan(filter)} />
            <ToolbarButton icon={<ReloadOutlined />} label={t('刷新')} disabled={loading || saving} onClick={() => scan(request.pattern)} />
          </Flex>
          <ErrorNotice error={error ? t(error) : undefined} />
          {page && (
            <>
              {page.keys.length ? (
                <KeyTree keys={page.keys} selected={selected?.ref} onSelect={read} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(page.cursor === '0' ? '没有匹配的键' : '当前扫描页没有匹配的键')} />
              )}
              {page.cursor !== '0' && (
                <Button loading={loading} disabled={saving} onClick={() => scan(request.pattern, page.cursor)}>
                  {t('扫描下一页')}
                </Button>
              )}
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
              <ToolbarButton size="small" icon={<DeleteOutlined />} label={t('删除键')} danger disabled={!detail || saving} onClick={() => promptAction('delete')} />
              <ToolbarButton size="small" icon={<ReloadOutlined />} label={t('刷新键详情')} disabled={saving} onClick={() => read(selected, true)} />
            </Flex>
          )
        }
      >
        <ErrorNotice error={detailError ? t(detailError) : undefined} />
        {!selected && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('选择一个键查看详情')} />}
        {detail && selected && <KeyEditor selected={selected} detail={detail} saving={saving} error={changeError} onSave={commit} clearError={() => setChangeError('')} ttlMillis={remainingTTL} />}
      </Card>
      <Modal
        title={action ? t(actionTitle[action]) : undefined}
        open={Boolean(action)}
        onCancel={() => {
          setAction(undefined)
          setChangeError('')
        }}
        onOk={() => void save()}
        confirmLoading={saving}
        closable={!saving}
        mask={{ closable: !saving }}
        keyboard={!saving}
        cancelButtonProps={{ disabled: saving }}
        okButtonProps={{ danger: action === 'delete', disabled: action === 'create' && (!target || ttl === null) }}
        okText={t(action === 'delete' ? '删除' : '保存')}
      >
        {action === 'delete' && <Typography.Paragraph>{t('确定删除 Redis 键「{value1}」？', { value1: selected?.name ?? '' })}</Typography.Paragraph>}
        <ErrorNotice error={changeError ? t(changeError) : undefined} />
        {action === 'create' && (
          <Form layout="horizontal" labelCol={{ flex: '92px' }} wrapperCol={{ flex: '1 1 0' }} disabled={saving}>
            {action === 'create' && (
              <Form.Item label={t('键名')} htmlFor="redis-key-target">
                <Input id="redis-key-target" placeholder={t('输入键名')} maxLength={16384} value={target} spellCheck={false} onChange={(event) => setTarget(event.target.value)} />
              </Form.Item>
            )}
            {action === 'create' && (
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
            {action === 'create' && (
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
