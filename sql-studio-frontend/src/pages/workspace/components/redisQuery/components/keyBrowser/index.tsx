import { DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Empty, Flex, Form, Input, InputNumber, Modal, theme, Typography } from 'antd'

import ErrorNotice from '@/components/errorNotice'
import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'

import ToolbarButton from '../../../toolbarButton'
import { useKeyBrowser } from '../../hooks/useKeyBrowser'
import KeyDelete from '../keyDelete'
import KeyEditor from '../keyEditor'
import KeyTree from '../keyTree'

export default function KeyBrowser({ id, database }: { id: string; database: number }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
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
    read,
    promptAction,
    save,
    commit
  } = useKeyBrowser(id, database)
  usePageError(error)
  usePageError(detailError)
  usePageError(lastChange === 'value' || lastChange === 'ttl' ? changeError : undefined)

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
          {page && (
            <>
              {page.keys.length ? (
                <KeyTree
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  keys={page.keys}
                  selected={selected?.ref}
                  onSelect={read}
                  onDelete={(item) => commit({ action: 'delete' }, item)}
                  onCreate={() => promptAction('create')}
                  onRefresh={() => scan(request.pattern)}
                  disabled={loading || saving}
                  saving={saving}
                  error={lastChange === 'delete' ? changeError : ''}
                  clearError={() => setChangeError('')}
                />
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
              <KeyDelete
                key={selected.ref}
                item={selected}
                saving={saving}
                disabled={!detail || loading}
                error={lastChange === 'delete' ? changeError : ''}
                onDelete={(item) => commit({ action: 'delete' }, item)}
                onClearError={() => setChangeError('')}
              >
                <ToolbarButton size="small" icon={<DeleteOutlined />} label={t('删除键')} danger disabled={!detail || loading || saving} />
              </KeyDelete>
              <ToolbarButton size="small" icon={<ReloadOutlined />} label={t('刷新键详情')} disabled={saving} onClick={() => read(selected, true)} />
            </Flex>
          )
        }
      >
        {!selected && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('选择一个键查看详情')} />}
        {detail && selected && (
          <KeyEditor
            selected={selected}
            detail={detail}
            saving={saving}
            onSave={async (change) => {
              await commit(change)
            }}
            clearError={() => setChangeError('')}
            ttlMillis={remainingTTL}
          />
        )}
      </Card>
      <Modal
        title={t('新增键')}
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
                onChange={(next) => {
                  setTTL(next)
                }}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
