import { DatabaseOutlined, EyeOutlined, ReloadOutlined, SearchOutlined, TableOutlined } from '@ant-design/icons'
import { Alert, Button, Dropdown, Empty, Input, Spin, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useState } from 'react'

import type { DBTable } from '@/typings/database'

/** 对象树只展示共享的元数据快照，不自行发起重复库表请求。 */
type Props = {
  connectionId: string
  database: string
  selectedTable: string
  selectedSchema: string
  onSelect: (database: string, table?: string, schema?: string) => void
  onAction: (action: string, database: string, table: string, schema?: string) => void
  onRefresh: () => void
  databases: string[]
  tables: Record<string, DBTable[]>
  loadTables: (database: string) => Promise<DBTable[]>
  loading: boolean
  error: string
  disabled: boolean
}
export default function DatabaseExplorer({ database, selectedTable, selectedSchema, onSelect, onAction, onRefresh, databases, tables, loadTables, loading, error, disabled }: Props) {
  const [expanded, setExpanded] = useState<string[]>(database ? [JSON.stringify([database])] : [])
  const [search, setSearch] = useState('')
  const nodes: DataNode[] = databases
    .map((db) => ({
      key: JSON.stringify([db]),
      title: <span title={db}>{db}</span>,
      icon: <DatabaseOutlined />,
      isLeaf: false,
      children: tables[db]
        ?.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
        .map((t) => ({
          key: JSON.stringify([db, t.name, t.schema || '']),
          title: (
            <Dropdown
              trigger={['contextMenu']}
              disabled={disabled}
              menu={{
                items: [
                  { key: 'new', label: '新建查询' },
                  { key: 'data', label: '查询数据' },
                  { key: 'structure', label: '查询结构' },
                  { key: 'ddl', label: '查看 DDL' }
                ],
                onClick: ({ key }) => {
                  onAction(key, db, t.name, t.schema || '')
                }
              }}
            >
              <span style={{ display: 'block', color: 'inherit' }} title={t.comment || t.name}>
                {t.schema ? `${t.schema}.` : ''}
                {t.name}
              </span>
            </Dropdown>
          ),
          icon: t.type.includes('VIEW') ? <EyeOutlined /> : <TableOutlined />,
          isLeaf: true
        }))
    }))
    .filter((node) => {
      const [db] = JSON.parse(String(node.key)) as string[]
      return !search || db.toLowerCase().includes(search.toLowerCase()) || (node.children?.length ?? 0) > 0 || !tables[db]
    })
  return (
    <div className="explorer">
      <div className="section-heading">
        <span>数据库对象</span>
        <Button type="text" icon={<ReloadOutlined />} aria-label="刷新数据库结构" onClick={onRefresh} disabled={disabled} />
      </div>
      <Input prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索库 / 表" allowClear aria-label="搜索数据库对象" />
      <div className="object-tree">
        {loading ? (
          <div className="tree-loading">
            <Spin />
          </div>
        ) : error ? (
          <Alert type="error" title="数据库连接失败" description={error} showIcon />
        ) : !databases.length ? (
          <Empty image={<DatabaseOutlined className="empty-state-icon" />} description="没有可访问的数据库" />
        ) : (
          <Tree
            showIcon
            disabled={disabled}
            blockNode
            treeData={nodes}
            expandedKeys={expanded}
            onExpand={(keys) => setExpanded(keys.map(String))}
            loadedKeys={Object.keys(tables).map((db) => JSON.stringify([db]))}
            selectedKeys={database ? [JSON.stringify(selectedTable ? [database, selectedTable, selectedSchema] : [database])] : []}
            loadData={async (node) => {
              const [db, table] = JSON.parse(String(node.key)) as string[]
              if (table || tables[db]) return
              await loadTables(db).catch(() => {})
            }}
            onSelect={(keys) => {
              if (keys.length) {
                const [db, table, schema] = JSON.parse(String(keys[0])) as string[]
                onSelect(db, table, schema)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
