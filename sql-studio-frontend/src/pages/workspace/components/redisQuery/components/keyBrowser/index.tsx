import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Empty, Flex, Form, Input, InputNumber, Modal, theme, Typography } from 'antd'
import { useState } from 'react'

import ContentLoading from '@/components/contentLoading'
import ErrorNotice from '@/components/errorNotice'
import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'
import type { RedisKey } from '@/services/redis'
import type { ThemeMode } from '@/typings/theme'

import ToolbarButton from '../../../toolbarButton'
import CountBadge from '../../../countBadge'
import { redisPanelLayout } from '../../../../constant/layout'
import { useKeyBrowser } from '../../hooks/useKeyBrowser'
import KeyDelete from '../keyDelete'
import KeyEditor from '../keyEditor'
import KeyTree from '../keyTree'

export default function KeyBrowser({ id, database, themeMode, active }: { id: string; database: number; themeMode: ThemeMode; active: boolean }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [deleteTarget, setDeleteTarget] = useState<RedisKey>()
  const {
    filter,
    setFilter,
    request,
    page,
    loading,
    error,
    selected,
    detail,
    detailError,
    detailLoading,
    remainingTTL,
    action,
    setAction,
    target,
    setTarget,
    value,
    setValue,
    ttl,
    setTTL,
    saving,
    changeError,
    lastChange,
    setChangeError,
    expandedKeys,
    setExpandedKeys,
    scan,
    stopScan,
    read,
    promptAction,
    save,
    commit
  } = useKeyBrowser(id, database, active)
  usePageError(active ? error : undefined)
  usePageError(active ? detailError : undefined)
  usePageError(active && (lastChange === 'value' || lastChange === 'ttl') ? changeError : undefined)
  const scanningMore = loading && (request.cursor !== '0' || request.continuous === true)
  const scanningBatch = scanningMore && !request.continuous
  const scanningContinuously = scanningMore && Boolean(request.continuous)
  const currentPage = page?.pattern === request.pattern ? page : undefined
  const needsRestart = currentPage?.cursor === null
  const nextCursor = currentPage?.cursor
  const loaded = currentPage?.keys.length ?? 0

  function requestDelete(item: RedisKey) {
    if (saving || loading) return
    setChangeError('')
    setDeleteTarget(item)
  }

  async function confirmDelete() {
    if (!deleteTarget || saving || loading) return
    if (await commit({ action: 'delete' }, deleteTarget)) setDeleteTarget(undefined)
  }

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
      <aside
        aria-label={t('键浏览')}
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
          <Typography.Text strong style={{ fontSize: token.fontSize }}>
            {t('键浏览')}
          </Typography.Text>
          <CountBadge count={loaded} />
          <Flex gap={token.marginXXS} style={{ marginInlineStart: 'auto' }}>
            <ToolbarButton icon={<PlusOutlined />} label={t('新增键')} disabled={saving} onClick={() => promptAction('create')} />
            <ToolbarButton icon={<ReloadOutlined />} label={t('刷新')} loading={loading} disabled={saving} onClick={() => scan(request.pattern)} />
          </Flex>
        </div>
        <div style={{ display: 'flex', flex: 'none', gap: 6, padding: '10px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Input
            value={filter}
            disabled={saving}
            onChange={(event) => setFilter(event.target.value)}
            onPressEnter={() => scan(filter)}
            placeholder={t('按模式匹配键，例如 user:*')}
            aria-label={t('筛选 Redis 键')}
            maxLength={256}
            style={{ flex: 1, minWidth: 0 }}
          />
          <ToolbarButton icon={<SearchOutlined />} label={t('筛选')} disabled={saving} onClick={() => scan(filter)} />
        </div>
        {(needsRestart || scanningMore || (Boolean(nextCursor) && nextCursor !== '0')) && (
          <div style={{ display: 'flex', flex: 'none', flexWrap: 'wrap', alignItems: 'center', gap: 4, minHeight: 30, padding: '4px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextTertiary, fontSize: token.fontSizeSM }}>
            {needsRestart && (
              <Button size="small" type="link" disabled={loading || saving} onClick={() => scan(request.pattern, '0', true)}>
                {t('重新扫描')}
              </Button>
            )}
            {nextCursor && nextCursor !== '0' && (
              <>
                <Button size="small" type="link" loading={scanningBatch} disabled={(loading && !scanningBatch) || saving} onClick={() => scan(request.pattern, nextCursor)}>
                  {t('扫描下一批')}
                </Button>
                <Button size="small" type="link" loading={scanningContinuously} disabled={(loading && !scanningContinuously) || saving} onClick={() => scan(request.pattern, nextCursor, true)}>
                  {t('连续扫描')}
                </Button>
              </>
            )}
            {scanningMore && (
              <Button size="small" type="link" onClick={stopScan}>
                {t('停止扫描')}
              </Button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, padding: '4px 0 8px' }}>
          {loading && !currentPage ? (
            <ContentLoading label={t('正在加载…')} />
          ) : currentPage?.keys.length ? (
            <KeyTree
              expandedKeys={expandedKeys}
              onExpand={setExpandedKeys}
              keys={currentPage.keys}
              selected={selected?.ref}
              onSelect={read}
              onRequestDelete={requestDelete}
              onCreate={() => promptAction('create')}
              onRefresh={() => scan(request.pattern)}
              disabled={loading || saving || Boolean(deleteTarget)}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(page?.cursor === '0' ? '没有匹配的键' : '当前扫描页没有匹配的键')} style={{ marginTop: 48 }} />
          )}
        </div>
      </aside>

      <section style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
        {!selected ? (
          <div style={{ display: 'grid', flex: 1, placeItems: 'center', padding: 24 }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('选择一个键查看详情')} />
          </div>
        ) : detailLoading ? (
          <ContentLoading label={t('正在读取键详情…')} />
        ) : detail ? (
          <KeyEditor
            selected={selected}
            detail={detail}
            saving={saving}
            themeMode={themeMode}
            onSave={async (change) => {
              await commit(change)
            }}
            clearError={() => setChangeError('')}
            ttlMillis={remainingTTL}
            onDelete={() => requestDelete(selected)}
            onRefresh={() => read(selected, true)}
          />
        ) : (
          <div style={{ display: 'grid', flex: 1, placeItems: 'center', padding: 24 }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('键详情暂不可用')} />
          </div>
        )}
      </section>

      {active && (
        <KeyDelete
          item={deleteTarget}
          saving={saving}
          disabled={loading}
          error={lastChange === 'delete' ? changeError : ''}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            if (!saving) setDeleteTarget(undefined)
          }}
        />
      )}
      <Modal
        title={t('新增键')}
        open={active && Boolean(action)}
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
        okButtonProps={{ disabled: !target || ttl === null }}
        okText={t('保存')}
      >
        <ErrorNotice error={lastChange === 'create' ? changeError : undefined} />
        {action === 'create' && (
          <Form layout="horizontal" labelCol={{ flex: '92px' }} wrapperCol={{ flex: '1 1 0' }} disabled={saving}>
            <Form.Item label={t('键名')} htmlFor="redis-key-target">
              <Input id="redis-key-target" placeholder={t('输入键名')} maxLength={16384} value={target} spellCheck={false} onChange={(event) => setTarget(event.target.value)} />
            </Form.Item>
            <Form.Item label={t('键值')} htmlFor="redis-key-value">
              <Input.TextArea id="redis-key-value" placeholder={t('输入键值，可留空')} maxLength={16384} value={value} rows={8} spellCheck={false} onChange={(event) => setValue(event.target.value)} />
            </Form.Item>
            <Form.Item label="TTL" htmlFor="redis-key-ttl" extra={t('填 0 设为永久有效')}>
              <InputNumber
                id="redis-key-ttl"
                placeholder={t('输入过期秒数')}
                suffix={<Typography.Text type="secondary">{t('秒')}</Typography.Text>}
                min={0}
                max={315360000}
                precision={0}
                value={ttl}
                onChange={(next) => setTTL(next)}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
