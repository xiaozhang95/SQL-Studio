import { Button, Flex, Form, Input, InputNumber, Space, Tag, theme, Typography } from 'antd'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import type { RedisKey, RedisKeyChange, RedisKeyDetail } from '@/services/redis'

import { useKeyEditor } from '../../hooks/useKeyEditor'

type Props = {
  selected: RedisKey
  detail: RedisKeyDetail
  saving: boolean
  error: string
  onSave: (change: RedisKeyChange) => Promise<void>
  clearError: () => void
  ttlMillis: number
}

function formatRemainingTime(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const time = [Math.floor((seconds % 86400) / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':')
  return { days, time }
}

export default function KeyEditor({ selected, detail, saving, error, onSave, clearError, ttlMillis }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const editor = useKeyEditor(selected, detail, ttlMillis, onSave, clearError)
  const remaining = editor.remainingSeconds === undefined ? undefined : formatRemainingTime(editor.remainingSeconds)
  const countdown = !remaining ? t('永久有效') : remaining.days > 0 ? t('剩余 {days} 天 {time}', remaining) : t('剩余 {time}', remaining)
  const valueHint = !detail.editable
    ? '当前键值类型或大小不支持直接编辑'
    : detail.type === 'set' || detail.type === 'list'
      ? '使用 JSON 字符串数组编辑成员'
      : detail.type === 'hash'
        ? '使用 JSON 二元数组编辑字段和值'
        : detail.type === 'zset'
          ? '使用 JSON 二元数组编辑成员和分数'
          : undefined
  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ flex: '92px' }}
      labelAlign="right"
      wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }}
      styles={{ label: { color: token.colorTextTertiary } }}
      disabled={saving}
    >
      <Form.Item label={`${t('键名')}:`} htmlFor="redis-detail-name" style={{ marginBottom: token.marginSM }}>
        <Input
          id="redis-detail-name"
          aria-label={t('键名')}
          value={editor.name}
          disabled={saving || detail.name === undefined}
          maxLength={16384}
          placeholder={t('输入键名')}
          style={{ width: '100%', flex: 1, minWidth: 0 }}
          onChange={(event) => editor.changeName(event.target.value)}
        />
      </Form.Item>
      <Form.Item label={`${t('类型')}:`} style={{ marginBottom: token.marginSM }}>
        <Flex wrap gap="middle" align="center" style={{ minHeight: token.controlHeight }}>
          <Tag>{detail.type}</Tag>
          {detail.size >= 0 && (
            <Flex gap="small" align="center">
              <Typography.Text style={{ color: token.colorTextTertiary }}>{t(detail.type === 'string' ? '字节数' : '元素数量')}:</Typography.Text>
              <Typography.Text>{detail.size.toLocaleString()}</Typography.Text>
            </Flex>
          )}
        </Flex>
      </Form.Item>
      <Form.Item
        label="TTL:"
        htmlFor="redis-detail-ttl"
        extra={t('填 0 设为永久有效')}
        validateStatus={editor.ttlInvalid ? 'error' : undefined}
        help={editor.ttlInvalid ? t('Redis TTL 秒数无效') : undefined}
        style={{ marginBottom: token.marginSM }}
      >
        <Space.Compact block>
          <InputNumber
            id="redis-detail-ttl"
            aria-label={t('编辑 TTL')}
            placeholder={t('输入过期秒数')}
            suffix={t('秒')}
            min={0}
            max={editor.maximumTTL}
            precision={0}
            value={editor.ttl}
            status={editor.ttlInvalid ? 'error' : undefined}
            onChange={editor.changeTTL}
            style={{ width: '100%', flex: 1, minWidth: 0 }}
          />
          <Button disabled style={{ flex: 'none' }}>
            {countdown}
          </Button>
        </Space.Compact>
      </Form.Item>
      <Form.Item
        label={`${t('键值')}:`}
        htmlFor="redis-detail-value"
        extra={
          detail.truncated || valueHint ? (
            <>
              {detail.truncated && <div>{t('仅显示部分内容')}</div>}
              {valueHint && <div>{t(valueHint)}</div>}
            </>
          ) : undefined
        }
        style={{ marginBottom: token.marginSM }}
      >
        <Input.TextArea
          id="redis-detail-value"
          aria-label={t('键值')}
          rows={8}
          readOnly={!detail.editable}
          maxLength={16384}
          value={editor.value}
          placeholder={t(detail.type === 'string' ? '输入键值，可留空' : '输入 JSON 格式的键值')}
          spellCheck={false}
          style={{ width: '100%', flex: 1, minWidth: 0 }}
          onChange={(event) => editor.changeValue(event.target.value)}
        />
      </Form.Item>
      <ErrorNotice error={error ? t(error) : undefined} />
      <Flex justify="end" gap="small" style={{ marginTop: token.marginSM }}>
        <Button disabled={saving} onClick={editor.cancel}>
          {t('取消')}
        </Button>
        <Button disabled={saving || !editor.dirty || editor.ttlInvalid} loading={saving} onClick={() => void editor.save()}>
          {t('保存')}
        </Button>
      </Flex>
    </Form>
  )
}
