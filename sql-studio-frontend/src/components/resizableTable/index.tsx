import { Table } from 'antd'
import type { TableProps } from 'antd'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ThHTMLAttributes } from 'react'
import { useRef, useState } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

const resizableTableLayout = { minimumColumnWidth: 80, keyboardStep: 16 } as const

type ResizeState = { key: string; widths: Record<number, number>; total: number }

type ResizableTableProps<RecordType extends object> = TableProps<RecordType> & {
  /** 结果或列结构变化时重置列宽。 */
  resizeKey?: string
}

/** 表头右缘的列宽手柄与排序点击分离；手柄可通过左右方向键微调。 */
function ResizableHeaderCell({ className, children, ...cellProps }: ThHTMLAttributes<HTMLTableCellElement>) {
  const { t } = useTranslation()
  return (
    <th className={className} {...cellProps}>
      {children}
      {className?.includes('resizable-table-header') && (
        <span
          className="resizable-column-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('调整列宽')}
          tabIndex={0}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') event.stopPropagation()
          }}
        />
      )}
    </th>
  )
}

/** Ant Design Table 的统一列宽拖拽入口；固定列保持原宽，其余列可调整。 */
export function ResizableTable<RecordType extends object>({
  columns = [],
  resizeKey,
  className,
  scroll,
  components,
  tableLayout,
  ...props
}: ResizableTableProps<RecordType>) {
  const container = useRef<HTMLDivElement>(null)
  const columnSignature = columns.map((column, index) => `${index}:${String(column.key ?? '')}`).join('|')
  const sizingKey = `${resizeKey ?? ''}:${columnSignature}`
  const [sizing, setSizing] = useState<ResizeState>({ key: '', widths: {}, total: 0 })
  const widths = sizing.key === sizingKey ? sizing.widths : {}
  const sized = Object.keys(widths).length > 0

  function measure() {
    const head = container.current?.querySelector('.ant-table-thead')
    const table = container.current?.querySelector('table')
    if (!head || !table) return { widths: {} as Record<number, number>, total: 0 }
    const resizableColumns = columns
      .map((_, index) => index)
      .filter((index) => {
        const column = columns[index]
        return !('children' in column) && !column.fixed
      })
    const cells = [...head.querySelectorAll<HTMLElement>('th.resizable-table-header')]
    return {
      widths: Object.fromEntries(cells.map((cell, position) => [resizableColumns[position], Math.round(cell.getBoundingClientRect().width)])),
      total: Math.round(table.getBoundingClientRect().width)
    }
  }

  function resizeTo(base: { widths: Record<number, number>; total: number }, index: number, width: number, startWidth: number) {
    const nextWidth = Math.max(resizableTableLayout.minimumColumnWidth, Math.round(width))
    setSizing({
      key: sizingKey,
      widths: { ...base.widths, [index]: nextWidth },
      total: Math.max(0, base.total + nextWidth - Math.round(startWidth))
    })
  }

  function startResize(event: ReactPointerEvent<HTMLTableCellElement>, index: number) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const base = sized ? { widths, total: sizing.total } : measure()
    const startWidth = event.currentTarget.getBoundingClientRect().width
    const startX = event.clientX
    const element = container.current
    const handleMove = (moveEvent: PointerEvent) => {
      resizeTo(base, index, startWidth + moveEvent.clientX - startX, startWidth)
    }
    const stop = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      element?.style.removeProperty('cursor')
      element?.style.removeProperty('user-select')
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    if (element) {
      element.style.cursor = 'col-resize'
      element.style.userSelect = 'none'
    }
  }

  function nudgeColumn(event: ReactKeyboardEvent<HTMLTableCellElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const base = sized ? { widths, total: sizing.total } : measure()
    const currentWidth = event.currentTarget.getBoundingClientRect().width
    const width = currentWidth + (event.key === 'ArrowRight' ? resizableTableLayout.keyboardStep : -resizableTableLayout.keyboardStep)
    resizeTo(base, index, width, currentWidth)
  }

  const resizedColumns = columns.map((column, index) => {
    if ('children' in column || column.fixed) return column
    return {
      ...column,
      width: widths[index] ?? column.width,
      onHeaderCell: () => ({
        className: 'resizable-table-header',
        onPointerDown: (event: ReactPointerEvent<HTMLTableCellElement>) => {
          if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('resizable-column-resizer')) return
          startResize(event, index)
        },
        onKeyDown: (event: ReactKeyboardEvent<HTMLTableCellElement>) => {
          if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('resizable-column-resizer')) return
          nudgeColumn(event, index)
        }
      })
    }
  })

  return (
    <div ref={container} className={`resizable-table${sized ? ' resizable-table-sized' : ''}`}>
      <Table<RecordType>
        {...props}
        className={className}
        columns={resizedColumns}
        components={{ ...components, header: { ...components?.header, cell: ResizableHeaderCell } }}
        scroll={sized ? { ...scroll, x: sizing.total } : scroll}
        tableLayout={sized ? 'fixed' : tableLayout}
      />
    </div>
  )
}
