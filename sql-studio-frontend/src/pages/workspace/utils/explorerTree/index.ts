import type { DataNode } from 'antd/es/tree'

import type { DatabaseExplorerAdapter } from '@/databases/typings'
import type { Connection } from '@/typings/database'
import type { QueryScope } from '@/typings/workspace'

import { connectionGroupName } from '../../../../constant/connectionGroup/index.ts'
import type { useDatabaseObjects } from '../../hooks/useDatabaseObjects'
import { indexDescription, objectNodeKey as key } from '../objectTree/index.ts'

export type ExplorerNode = Omit<DataNode, 'key' | 'title' | 'children'> & {
  key: string
  title: string
  kind: string
  owner: string
  database: string
  table: string
  schema?: string
  tooltip?: string
  primary?: boolean
  view?: boolean
  connection?: Connection
  status?: 'is-connected' | 'is-error' | 'is-closed'
  retry?: 'connection' | 'database' | 'table'
  children?: ExplorerNode[]
}
type Snapshots = ReturnType<typeof useDatabaseObjects>['snapshots']
/** 仅从当前可见且已连接的树节点取库范围，忽略连接和分组节点。 */
export function explorerQueryScope(node: ExplorerNode | undefined, connected: boolean, layout?: DatabaseExplorerAdapter): QueryScope | undefined {
  if (!node || !connected || !node.owner || !node.database || !['database', 'schema', 'tables', 'views', 'table', 'columns', 'column', 'indexes', 'index'].includes(node.kind)) return undefined
  const schema = node.schema || (node.table && layout ? layout.tableIdentity(node.table).schema : undefined)
  return { connectionId: node.owner, database: node.database, ...(schema ? { schema } : {}), table: '' }
}
export function buildExplorerTree(
  connections: readonly Connection[],
  snapshots: Snapshots,
  expanded: readonly string[],
  search: string,
  layouts: Readonly<Record<string, DatabaseExplorerAdapter | undefined>> = {}
) {
  const open = new Set(expanded),
    loadedKeys: string[] = [],
    byKey = new Map<string, ExplorerNode>()
  const term = search.trim().toLowerCase(),
    matches = (value: string) => value.toLowerCase().includes(term)
  const make = (kind: string, title: string, owner = '', database = '', table = '', name?: string): ExplorerNode => {
    const parts = [kind, owner]
    if (database) parts.push(database)
    if (table) parts.push(table)
    if (name !== undefined) parts.push(name)
    const node: ExplorerNode = { key: key(...parts), kind, title, owner, database, table, tooltip: title, isLeaf: true }
    byKey.set(node.key, node)
    return node
  }
  const placeholder = (kind: string, title: string, id: string, db: string, table = '') => {
    const node = make(kind, title, id, db, table)
    node.selectable = false
    return node
  }
  const nodes: ExplorerNode[] = [],
    groups = new Map<string, ExplorerNode>()
  let ready = true
  for (const connection of connections) {
    const id = connection.id,
      state = snapshots[id],
      connected = state?.status === 'connected'
    const groupName = connectionGroupName(connection.group),
      connectionMatch = matches(connection.name) || matches(groupName)
    const root = make('connection', connection.name, id)
    if (open.has(root.key) && (!state || state.status === 'loading')) ready = false
    root.connection = connection
    root.isLeaf = false
    root.status = connected ? 'is-connected' : state?.status === 'error' ? 'is-error' : 'is-closed'
    root.className = `connection-tree-node ${root.status}`
    root.tooltip = `${connection.host}:${connection.port}${state?.error ? `\n${state.error}` : ''}`
    if (connected) {
      loadedKeys.push(root.key)
      const databases = state.databases.filter(
        (db) => connectionMatch || matches(db) || !state.tables[db] || state.tables[db].some((table) => matches(table.name)) || state.schemas?.[db]?.some(matches)
      )
      // 折叠分支保留原始元数据，不创建后代节点、React 元素或右键菜单。
      if ((open.has(key('group', groupName)) || term) && (open.has(root.key) || term))
        root.children = databases.map((db) => {
          const databaseNode = make('database', db, id, db)
          databaseNode.isLeaf = false
          const tables = state.tables[db]
          if (open.has(databaseNode.key) && !tables && !state.tableErrors[db]) ready = false
          if (tables) loadedKeys.push(databaseNode.key)
          if (!open.has(databaseNode.key)) return databaseNode
          if (state.tableErrors[db]) {
            const error = placeholder('error', state.tableErrors[db], id, db)
            error.retry = 'database'
            databaseNode.children = [error]
            return databaseNode
          }
          if (!tables) return databaseNode
          const values = tables.filter((table) => connectionMatch || matches(db) || matches(table.name))
          const layout = layouts[id]
          const names = new Map<string, string>()
          const addCategories = (parent: ExplorerNode, entries: typeof values, schema?: string) => {
            parent.children = []
            for (const [kind, title, view] of [
              ['tables', '表', false],
              ['views', '视图', true]
            ] as const) {
              const items = entries.filter((table) => table.type.includes('VIEW') === view)
              if (view && !items.length) continue
              const category = make(kind, title, id, db, '', schema)
              category.schema = schema
              category.isLeaf = false
              loadedKeys.push(category.key)
              parent.children.push(category)
              if (!open.has(category.key)) continue
              category.children = items.map((table) => {
                const node = make('table', names.get(table.name) ?? table.name, id, db, table.name)
                node.view = view
                node.isLeaf = view
                node.tooltip = table.name + (table.comment ? `\n${table.comment}` : '')
                if (view) return node
                const identity = key(db, table.name),
                  details = state.details[identity],
                  error = state.detailErrors[identity]
                if (details) loadedKeys.push(node.key)
                if (!open.has(node.key)) return node
                if (!details && !error) ready = false
                if (error && !details) {
                  const failed = placeholder('detail-error', error, id, db, table.name)
                  failed.retry = 'table'
                  node.children = [failed]
                  return node
                }
                if (!details) return node
                node.children = []
                for (const kind of ['columns', 'indexes'] as const) {
                  const group = make(kind, kind === 'columns' ? '字段' : '索引', id, db, table.name)
                  group.isLeaf = false
                  loadedKeys.push(group.key)
                  node.children.push(group)
                  if (!open.has(group.key)) continue
                  group.children =
                    kind === 'columns'
                      ? details.columns.map((column) => {
                          const item = make('column', column.name, id, db, table.name, column.name)
                          item.primary = column.key === 'PRI'
                          item.tooltip = `${column.name} · ${column.type}${item.primary ? ' · 主键' : ''}${column.comment ? `\n${column.comment}` : ''}`
                          return item
                        })
                      : details.indexes.map((index) => {
                          const item = make('index', index.name, id, db, table.name, index.name)
                          item.primary = index.primary || index.name === 'PRIMARY'
                          item.tooltip = `${index.name}\n${indexDescription(index)}`
                          return item
                        })
                  if (!group.children.length) group.children = [placeholder(`empty-${kind}`, kind === 'columns' ? '暂无字段' : '暂无索引', id, db, table.name)]
                }
                return node
              })
              if (!category.children.length) {
                const empty = make('empty-tables', '暂无表', id, db, '', schema)
                empty.selectable = false
                category.children = [empty]
              }
            }
          }
          if (!layout) addCategories(databaseNode, values)
          else {
            const schemas = new Map<string, typeof values>((state.schemas?.[db] || []).map((schema) => [schema, []]))
            for (const table of values) {
              const identity = layout.tableIdentity(table.name)
              names.set(table.name, identity.name)
              if (!schemas.has(identity.schema)) schemas.set(identity.schema, [])
              schemas.get(identity.schema)!.push(table)
            }
            databaseNode.children = []
            for (const [schema, entries] of [...schemas].sort(([left], [right]) => left.localeCompare(right))) {
              if (term && !connectionMatch && !matches(db) && !matches(schema) && !entries.length) continue
              const node = make('schema', schema, id, db, '', schema)
              node.schema = schema
              node.isLeaf = false
              loadedKeys.push(node.key)
              databaseNode.children.push(node)
              if (open.has(node.key)) addCategories(node, entries, schema)
            }
          }
          return databaseNode
        })
      if (!connectionMatch && !databases.length) {
        byKey.delete(root.key)
        continue
      }
    } else if (state?.error && open.has(root.key)) {
      const error = placeholder('error', state.error, id, '')
      error.retry = 'connection'
      root.children = [error]
    }
    let group = groups.get(groupName)
    if (!group) {
      group = make('group', groupName, groupName)
      group.isLeaf = false
      group.selectable = false
      group.children = []
      groups.set(groupName, group)
      nodes.push(group)
      loadedKeys.push(group.key)
    }
    // 关闭分组时仍保留连接根节点，搜索可以显式展开分组展示匹配项。
    group.children!.push(root)
  }
  const expandedKeys = expanded.filter((value) => byKey.has(value))
  if (term) for (const group of groups.values()) if (!expandedKeys.includes(group.key)) expandedKeys.push(group.key)
  return { nodes, loadedKeys, expandedKeys, byKey, ready }
}
