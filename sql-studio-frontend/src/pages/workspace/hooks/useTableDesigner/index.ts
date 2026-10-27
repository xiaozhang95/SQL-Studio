import { App } from 'antd'
import { useCallback, useState } from 'react'

import { ObjectAction } from '@/databases/typings/objectManagement'
import type { ObjectChange } from '@/databases/typings/objectManagement'
import type { Connection } from '@/typings/database'
import type { WorkspaceTab } from '@/typings/workspace'

import { useObjectManagement } from '../useObjectManagement'

export type TableDesignerOptions = {
  page: WorkspaceTab
  connections: Connection[]
  blocked: boolean
  onBusyChange: (id: string, busy: boolean) => void
  onDirtyChange: (id: string, dirty: boolean) => void
  onCommitted: (id: string, change: ObjectChange) => void
  onChanged: (change: ObjectChange) => Promise<void>
}
/** 每个表设计页独立持有 Form、请求、原始结构与预览，切换标签不重新初始化。 */
export function useTableDesigner({ page, connections, blocked, onBusyChange, onDirtyChange, onCommitted, onChanged }: TableDesignerOptions) {
  const { modal } = App.useApp()
  const [initial] = useState(() => ({
    action: page.kind === 'table-create' ? ObjectAction.CreateTable : ObjectAction.EditTable,
    target: { connectionId: page.connectionId, database: page.database, table: page.table }
  }))
  const busy = useCallback((value: boolean) => onBusyChange(page.id, value), [onBusyChange, page.id])
  const dirty = useCallback((value: boolean) => onDirtyChange(page.id, value), [onDirtyChange, page.id])
  const committed = async (change: ObjectChange) => {
    onCommitted(page.id, change)
    await onChanged(change)
  }
  const manager = useObjectManagement({ connections, blocked, onBusyChange: busy, onDirtyChange: dirty, onChanged: committed, initial, keepOpen: true })
  const reload = () => {
    if (manager.dirty) modal.confirm({ title: '放弃未保存的表结构修改并重新加载？', okText: '重新加载', cancelText: '继续编辑', onOk: manager.reload })
    else void manager.reload()
  }
  return { ...manager, reload }
}
