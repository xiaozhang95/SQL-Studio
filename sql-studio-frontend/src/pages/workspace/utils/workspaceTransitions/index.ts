import type { ObjectChange } from '@/databases/typings/objectManagement'
import type { Connection } from '@/typings/database'
import type { ExplorerLayout, WorkspaceTab } from '@/typings/workspace'

import { ObjectAction } from '../../../../databases/typings/objectManagement/index.ts'

/** 按连接、库、schema 和表身份查找对象结果页，SQL 与设计页不参与匹配。 */
export function findExplorerPage(tabs: readonly WorkspaceTab[], kind: 'data' | 'structure', connectionId: string, database: string, table: string, schema?: string) {
  return tabs.find((page) => page.kind === kind && page.connectionId === connectionId && page.database === database && page.table === table && (page.schema || '') === (schema || ''))
}

export function upsertConnection(connections: readonly Connection[], saved: Connection): Connection[] {
  return connections.some((item) => item.id === saved.id) ? connections.map((item) => (item.id === saved.id ? saved : item)) : [...connections, saved]
}

export function queryScopesAfterChange(tabs: WorkspaceTab[], { action, target, name }: ObjectChange): WorkspaceTab[] {
  return tabs.map((tab) => {
    if (tab.kind !== 'query' || tab.connectionId !== target.connectionId || tab.database !== target.database) return tab
    if (action === ObjectAction.DropDatabase) return { ...tab, database: '', schema: '', table: '' }
    if (tab.table !== target.table) return tab
    if (action === ObjectAction.DropTable) return { ...tab, table: '' }
    if (action === ObjectAction.RenameTable) return { ...tab, table: name }
    return tab
  })
}

/** 仅处理确实失效的节点；新增对象不会展开、选中或折叠任何节点。 */
export function explorerAfterChange(layout: ExplorerLayout, { action, target, name }: ObjectChange): ExplorerLayout {
  if (![ObjectAction.DropDatabase, ObjectAction.DropTable, ObjectAction.RenameTable].some((value) => value === action)) return layout
  const update = (keys: string[]) =>
    keys.flatMap((key) => {
      const parts = JSON.parse(key) as string[]
      if (parts[0] === 'group' || parts[1] !== target.connectionId || parts[2] !== target.database) return [key]
      if (action === ObjectAction.DropDatabase) return []
      if (parts[3] !== target.table) return [key]
      if (action === ObjectAction.DropTable) return []
      parts[3] = name
      return [JSON.stringify(parts)]
    })
  return { ...layout, expanded: update(layout.expanded), selected: update(layout.selected) }
}
