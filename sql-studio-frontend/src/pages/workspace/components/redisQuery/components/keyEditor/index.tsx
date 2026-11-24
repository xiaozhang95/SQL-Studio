import { ClockCircleOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { EditorState } from '@codemirror/state'
import { placeholder } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { Button, Flex, Form, Input, InputNumber, Tag, theme, Typography } from 'antd'
import { useMemo } from 'react'

import { useTranslation } from '@/hooks/useTranslation'
import type { RedisKey, RedisKeyChange, RedisKeyDetail } from '@/services/redis'
import type { ThemeMode } from '@/typings/theme'

import { redisPanelLayout } from '../../../../constant/layout'
import { sqlEditorAppearance } from '../../../../utils/editorAppearance'
import ToolbarButton from '../../../toolbarButton'
import { useKeyEditor } from '../../hooks/useKeyEditor'

const valueLimit = 16384

type Props = {
  selected: RedisKey
  detail: RedisKeyDetail
  saving: boolean
  themeMode: ThemeMode
  onSave: (change: RedisKeyChange) => Promise<void>
  clearError: () => void
  ttlMillis: number
  onDelete: () => void
  onRefresh: () => void
}

function formatRemainingTime(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const time = [Math.floor((seconds % 86400) / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':')
  return { days, time }
}

export default function KeyEditor({ selected, detail, saving, themeMode, onSave, clearError, ttlMillis, onDelete, onRefresh }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const editor = useKeyEditor(selected, detail, ttlMillis, onSave, clearError)
  const remaining = editor.remainingSeconds === undefined ? undefined : formatRemainingTime(editor.remainingSeconds)
  const countdown = !remaining ? t('永久有效') : remaining.days > 0 ? t('剩余 {days} 天 {time}', remaining) : t('剩余 {time}', remaining)
  const initialTTL = detail.ttlMillis < 0 ? 0 : Math.ceil(detail.ttlMillis / 1000)
  const valueHint = t(detail.type === 'string' ? '输入键值，可留空' : '输入 JSON 格式的键值')
  const valueExtensions = useMemo(
    () => [sqlEditorAppearance, EditorState.changeFilter.of((transaction) => transaction.newDoc.length <= valueLimit), placeholder(valueHint)],
    [valueHint]
  )
  return (
    <Flex vertical style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          flex: 'none',
          alignItems: 'center',
          gap: 14,
          height: redisPanelLayout.headerHeight,
          paddingInline: 16,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer
        }}
      >
        <Flex align="center" gap={6} wrap style={{ minWidth: 0 }}>
          <Tag style={{ marginInlineEnd: 0 }}>{detail.type}</Tag>
          <Tag style={{ marginInlineEnd: 0 }}>
            {detail.type === 'string' ? t('字节数') : t('元素数量')} {detail.size.toLocaleString()}
          </Tag>
          <Tag icon={<ClockCircleOutlined />} style={{ marginInlineEnd: 0 }}>
            {countdown}
          </Tag>
        </Flex>
        <Flex gap={token.marginXXS} style={{ flex: 'none', marginInlineStart: 'auto' }}>
          <ToolbarButton icon={<ReloadOutlined />} label={t('刷新键详情')} disabled={saving} onClick={onRefresh} />
          <ToolbarButton danger icon={<DeleteOutlined />} label={t('删除键')} disabled={saving} onClick={onDelete} />
        </Flex>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px', background: token.colorBgLayout }}>
        <Form
          layout="horizontal"
          colon={false}
          labelCol={{ flex: '48px' }}
          labelAlign="left"
          wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }}
          disabled={saving}
        >
          <Form.Item label={`${t('键名')}:`} htmlFor="redis-detail-name" style={{ marginBottom: 16 }}>
            <Input
              id="redis-detail-name"
              aria-label={t('键名')}
              value={editor.name}
              disabled={saving || detail.name === undefined}
              maxLength={16384}
              spellCheck={false}
              onChange={(event) => editor.changeName(event.target.value)}
              style={{ fontFamily: token.fontFamilyCode }}
            />
          </Form.Item>

          <Form.Item
            label="TTL:"
            htmlFor="redis-detail-ttl"
            validateStatus={editor.ttlInvalid ? 'error' : undefined}
            help={editor.ttlInvalid ? t('Redis TTL 秒数无效') : undefined}
            style={{ marginBottom: 16 }}
          >
            <InputNumber
              id="redis-detail-ttl"
              aria-label={t('编辑 TTL')}
              placeholder={t('输入过期秒数')}
              suffix={t('秒')}
              min={0}
              max={editor.maximumTTL}
              precision={0}
              value={editor.ttlChanged ? editor.ttl : initialTTL}
              status={editor.ttlInvalid ? 'error' : undefined}
              onChange={editor.changeTTL}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label={`${t('键值')}:`} style={{ marginBottom: 16 }}>
            <div style={{ overflow: 'hidden', border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius }}>
              <div style={{ height: 286 }}>
                <CodeMirror
                  key={selected.ref}
                  value={editor.value}
                  height="100%"
                  theme={themeMode}
                  basicSetup={{ foldGutter: false, autocompletion: false, bracketMatching: false, closeBrackets: false, highlightSelectionMatches: false }}
                  extensions={valueExtensions}
                  indentWithTab={false}
                  readOnly={saving || !detail.editable}
                  onChange={editor.changeValue}
                  aria-label={t('键值')}
                  style={{ height: '100%' }}
                />
              </div>
              {detail.truncated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderTop: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextTertiary, fontSize: token.fontSizeSM }}>
                  {t('仅显示部分内容')}
                </div>
              )}
            </div>
          </Form.Item>
        </Form>
      </div>

      <div
        style={{
          display: 'flex',
          flex: 'none',
          alignItems: 'center',
          gap: 8,
          height: 44,
          paddingInline: 16,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer
        }}
      >
        {editor.dirty && (
          <Typography.Text type="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: token.colorWarning }} />
            {t('有未保存修改')}
          </Typography.Text>
        )}
        <Flex gap={6} style={{ marginInlineStart: 'auto' }}>
          <Button disabled={saving || !editor.dirty} onClick={editor.cancel}>
            {t('取消')}
          </Button>
          <Button type="primary" loading={saving} disabled={saving || !editor.dirty || editor.ttlInvalid} onClick={() => void editor.save()}>
            {t('保存')}
          </Button>
        </Flex>
      </div>
    </Flex>
  )
}
