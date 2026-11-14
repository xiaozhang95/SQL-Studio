import type { DatabaseExplorerAdapter } from '@/databases/typings'
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

/** 仅用已成功加载的库列表清理失效树身份，不把加载中或失败当作删库。 */
export function explorerAfterDatabasesLoaded(layout: ExplorerLayout, connectionId: string, databases: readonly string[]): ExplorerLayout {
  const names = new Set(databases)
  const keep = (key: string) => {
    const parts = JSON.parse(key) as string[]
    return parts[1] !== connectionId || parts.length < 3 || names.has(parts[2])
  }
  const expanded = layout.expanded.filter(keep)
  const selected = layout.selected.filter(keep)
  return expanded.length === layout.expanded.length && selected.length === layout.selected.length ? layout : { ...layout, expanded, selected }
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

/** SQL 文本及结果快照保留；更新重命名后的页面范围，删除时只清空查询范围。 */
export function pagesAfterSchemaChange(tabs: WorkspaceTab[], { action, target, name }: ObjectChange, layout: DatabaseExplorerAdapter): WorkspaceTab[] {
  if (action !== ObjectAction.RenameSchema && action !== ObjectAction.DropSchema) return tabs
  return tabs.map((page) => {
    if (page.connectionId !== target.connectionId || page.database !== target.database || page.schema !== target.schema) return page
    if (action === ObjectAction.DropSchema) return page.kind === 'query' ? { ...page, schema: '', table: '' } : page
    return { ...page, schema: name, table: page.table ? layout.tableInSchema(page.table, name) : '' }
  })
}

/** 仅处理确实失效的节点；新增对象不会展开、选中或折叠任何节点。 */
export function explorerAfterChange(layout: ExplorerLayout, { action, target, name }: ObjectChange, engine?: DatabaseExplorerAdapter): ExplorerLayout {
  if (![ObjectAction.DropDatabase, ObjectAction.DropTable, ObjectAction.RenameTable, ObjectAction.DropSchema, ObjectAction.RenameSchema].some((value) => value === action)) return layout
  const update = (keys: string[]) =>
    keys.flatMap((key) => {
      const parts = JSON.parse(key) as string[]
      if (parts[0] === 'group' || parts[1] !== target.connectionId || parts[2] !== target.database) return [key]
      if (action === ObjectAction.DropDatabase) return []
      if (action === ObjectAction.DropSchema || action === ObjectAction.RenameSchema) {
        if (['schema', 'tables', 'views', 'empty-tables'].includes(parts[0]) && parts[3] === target.schema) return []
        if (
          engine &&
          ['table', 'columns', 'column', 'indexes', 'index', 'foreign-keys', 'foreign-key', 'foreign-keys-error', 'detail-error'].includes(parts[0]) &&
          parts[3] &&
          engine.tableIdentity(parts[3]).schema === target.schema
        )
          return []
        return [key]
      }
      if (parts[3] !== target.table) return [key]
      if (action === ObjectAction.DropTable) return []
      parts[3] = name
      return [JSON.stringify(parts)]
    })
  return { ...layout, expanded: update(layout.expanded), selected: update(layout.selected) }
}
