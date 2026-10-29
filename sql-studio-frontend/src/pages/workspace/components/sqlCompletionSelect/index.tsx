import { Select, Typography } from 'antd'
import type { RefSelectProps } from 'antd/es/select'
import { useEffect, useMemo, useRef } from 'react'

import { sqlCompletionLayout } from '../../constant/layout'
import type { useSQLCompletionPopup } from '../../hooks/useSQLCompletionPopup'

type Props = { completion: ReturnType<typeof useSQLCompletionPopup> }

export default function SQLCompletionSelect({ completion }: Props) {
  const { popup, choose, close } = completion
  const select = useRef<RefSelectProps>(null)
  const options = useMemo(
    () =>
      popup?.items.map((item, index) => ({
        value: index,
        title: item.label,
        label: item.displayLabel || item.label,
        detail: item.detail
      })) ?? [],
    [popup?.items]
  )
  useEffect(() => {
    if (popup?.selected != null) select.current?.scrollTo({ index: popup.selected })
  }, [popup?.selected])
  if (!popup) return null
  return (
    <Select
      ref={select}
      aria-label="SQL 语法补全"
      open
      showSearch={false}
      value={popup.selected ?? undefined}
      options={options}
      optionRender={({ data }) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.label}</span>
          {data.detail && (
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: '45%' }}>
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
      styles={{ popup: { root: { visibility: 'visible', pointerEvents: 'auto' } } }}
    />
  )
}
