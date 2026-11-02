import { Checkbox, Space } from 'antd'
import { useEffect, useRef } from 'react'

import type { useDataEditing } from '../../hooks/useDataEditing'
import TemporalInput from '../temporalInput'

export default function DataCellEditor({ editor, disabled }: { editor: ReturnType<typeof useDataEditing>; disabled: boolean }) {
  const { cell, saving, change, save, finish } = editor
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) finish()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [finish])
  if (!cell) return null
  return (
    <div
      ref={container}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !saving) finish()
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void save()
      }}
    >
      <Space orientation="vertical" size={4} style={{ width: '100%' }} onDoubleClick={(event) => event.stopPropagation()}>
        <TemporalInput
          label="单元格内容"
          fieldType={cell.type}
          multiline
          placeholder={cell.isNull ? 'NULL' : '请输入内容（可留空）'}
          autoFocus
          value={cell.value}
          disabled={disabled || cell.isNull}
          onChange={(value) => change({ value })}
        />
        <Space size={4} wrap>
          <Checkbox disabled={disabled || !cell.nullable} checked={cell.isNull} onChange={(event) => change({ isNull: event.target.checked })}>
            NULL
          </Checkbox>
        </Space>
      </Space>
    </div>
  )
}
