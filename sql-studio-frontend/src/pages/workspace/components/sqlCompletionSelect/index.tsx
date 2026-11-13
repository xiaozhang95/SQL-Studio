import { CodeOutlined, DatabaseOutlined, EyeOutlined, FieldStringOutlined, FolderOutlined, FunctionOutlined, KeyOutlined, ProfileOutlined, TableOutlined } from '@ant-design/icons'
import type { Completion } from '@codemirror/autocomplete'
import { Select, Typography } from 'antd'
import type { RefSelectProps } from 'antd/es/select'
import { useEffect, useMemo, useRef } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

import { sqlCompletionLayout } from '../../constant/layout'
import type { SQLCompletionObjectKind } from '../../hooks/useSQLCompletion'
import type { useSQLCompletionPopup } from '../../hooks/useSQLCompletionPopup'

type Props = { completion: ReturnType<typeof useSQLCompletionPopup>; objectKinds: ReadonlyMap<string, SQLCompletionObjectKind> }

function CompletionIcon({ item, objectKinds }: { item: Completion; objectKinds: Props['objectKinds'] }) {
  const { t } = useTranslation()
  const types = item.type?.split(/\s+/) ?? []
  if (types.includes('keyword')) return <KeyOutlined aria-label={t('关键字')} title={t('关键字')} />
  if (types.includes('function')) return <FunctionOutlined aria-label={t('函数')} title={t('函数')} />
  if (types.includes('property')) return <ProfileOutlined aria-label={t('字段')} title={t('字段')} />
  if (types.includes('type') && item.boost === -1) return <FieldStringOutlined aria-label={t('数据类型')} title={t('数据类型')} />
  switch (objectKinds.get(item.label)) {
    case 'database':
      return <DatabaseOutlined aria-label={t('数据库')} title={t('数据库')} />
    case 'schema':
      return <FolderOutlined aria-label="Schema" title="Schema" />
    case 'table':
      return <TableOutlined aria-label={t('表')} title={t('表')} />
    case 'view':
      return <EyeOutlined aria-label={t('视图')} title={t('视图')} />
    case 'object':
      return <DatabaseOutlined aria-label={t('数据库对象')} title={t('数据库对象')} />
    default:
      return <CodeOutlined aria-label={t('其他候选')} title={t('其他候选')} />
  }
}

export default function SQLCompletionSelect({ completion, objectKinds }: Props) {
  const { t } = useTranslation()

  const { popup, choose, close } = completion
  const select = useRef<RefSelectProps>(null)
  const options = useMemo(
    () =>
      popup?.items.map((item, index) => ({
        value: index,
        title: item.label,
        label: item.displayLabel || item.label,
        detail: item.detail,
        icon: <CompletionIcon item={item} objectKinds={objectKinds} />
      })) ?? [],
    [popup?.items, objectKinds]
  )
  useEffect(() => {
    if (popup?.selected != null) select.current?.scrollTo({ index: popup.selected })
  }, [popup?.selected])
  if (!popup) return null
  return (
    <Select
      ref={select}
      aria-label={t('SQL 语法补全')}
      open
      showSearch={false}
      value={popup.selected ?? undefined}
      options={options}
      optionRender={({ data }) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ display: 'flex', flex: 'none', alignItems: 'center' }}>{data.icon}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.label}</span>
          {data.detail && (
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: '45%', font: 'inherit' }}>
              {data.detail}
            </Typography.Text>
          )}
        </span>
      )}
      listHeight={sqlCompletionLayout.height}
      virtual
      popupMatchSelectWidth={popup.width}
      getPopupContainer={() => document.body}
      onSelect={choose}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      popupRender={(menu) => <div onMouseDown={(event) => event.preventDefault()}>{menu}</div>}
      style={{ position: 'fixed', left: popup.left, top: popup.top, width: popup.width, height: 0, visibility: 'hidden', pointerEvents: 'none' }}
      styles={{ popup: { root: { visibility: 'visible', pointerEvents: 'auto', ...popup.typography }, listItem: popup.typography } }}
    />
  )
}
