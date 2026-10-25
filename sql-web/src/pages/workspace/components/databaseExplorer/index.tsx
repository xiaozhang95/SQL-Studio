import {
  CloseOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  FolderOutlined,
  LinkOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SearchOutlined,
  TableOutlined
} from '@ant-design/icons'
import { Dropdown, Empty, Input, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useEffect, useRef } from 'react'

import { connectionGroupName } from '@/constant/database'

import type { WorkspaceModel } from '../../hooks/useWorkspace'
import EngineIcon from '../engineIcon'

type Props = {
  model: Pick<WorkspaceModel, 'connections' | 'connectionAction' | 'openConnection' | 'databaseAction' | 'tableAction' | 'objects' | 'running' | 'explorer' | 'updateExplorer'>
}
const nodeKey = (...parts: string[]) => JSON.stringify(parts)

/** 连接、数据库和表共用一棵树；所有菜单携带完整连接范围，避免误用当前查询的连接。 */
export default function DatabaseExplorer({ model }: Props) {
  const { connections, connectionAction, databaseAction, tableAction, objects, running } = model
  const { explorer, updateExplorer } = model
  const { expanded, selected, search } = explorer
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = explorer.top
  }, [explorer.top, objects.snapshots])
  // 树的高亮只属于对象浏览器，不读取或修改任何查询标签的范围。
  const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase())
  const loadedKeys: string[] = []
  const connectionNodes: DataNode[] = connections.flatMap((connection): DataNode[] => {
    const id = connection.id
    const state = objects.snapshots[id]
    const connected = state?.status === 'connected'
    const status = connected ? 'is-connected' : state?.status === 'error' ? 'is-error' : 'is-closed'
    const connectionMatches = matches(connection.name) || matches(connectionGroupName(connection.group))
    if (connected) loadedKeys.push(nodeKey('connection', id))
    const children: DataNode[] | undefined = connected
      ? state.databases
          .map((db) => {
            const dbMatches = connectionMatches || matches(db)
            if (state.tables[db]) loadedKeys.push(nodeKey('database', id, db))
            const tables: DataNode[] | undefined = state.tables[db]
              ?.filter((table) => dbMatches || matches(table.name))
              .map((table) => ({
                key: nodeKey('table', id, db, table.name),
                title: (
                  <Dropdown
                    trigger={['contextMenu']}
                    disabled={running}
                    menu={{
                      items: [
                        { key: 'new', label: '新建查询', icon: <CodeOutlined /> },
                        { key: 'data', label: '查询数据', icon: <TableOutlined /> },
                        { key: 'structure', label: '查询结构', icon: <ProfileOutlined /> },
                        { key: 'ddl', label: '查看 DDL', icon: <FileTextOutlined /> }
                      ],
                      onClick: ({ key, domEvent }) => {
                        domEvent.stopPropagation()
                        void tableAction(key, id, db, table.name)
                      }
                    }}
                  >
                    <span title={table.comment || table.name}>{table.name}</span>
                  </Dropdown>
                ),
                icon: table.type.includes('VIEW') ? <EyeOutlined /> : <TableOutlined />,
                isLeaf: true
              }))
            return {
              key: nodeKey('database', id, db),
              title: (
                <Dropdown
                  trigger={['contextMenu']}
                  disabled={running}
                  menu={{
                    items: [
                      { key: 'new', label: '新建查询', icon: <CodeOutlined /> },
                      { key: 'tables', label: '查看表列表', icon: <TableOutlined /> },
                      { key: 'refresh', label: '刷新数据库结构', icon: <ReloadOutlined /> }
                    ],
                    onClick: ({ key, domEvent }) => {
                      domEvent.stopPropagation()
                      void databaseAction(key, id, db)
                    }
                  }}
                >
                  <span title={db}>{db}</span>
                </Dropdown>
              ),
              icon: <DatabaseOutlined />,
              isLeaf: false,
              children: state.tableErrors[db]
                ? [
                    {
                      key: nodeKey('error', id, db),
                      title: (
                        <span className="tree-error" title={state.tableErrors[db]}>
                          {state.tableErrors[db]}
                        </span>
                      ),
                      selectable: false,
                      isLeaf: true
                    }
                  ]
                : tables
            }
          })
          .filter((node) => {
            const db = (JSON.parse(String(node.key)) as string[])[2]
            return connectionMatches || matches(db) || !state.tables[db] || Boolean(node.children?.length)
          })
      : state?.error
        ? [
            {
              key: nodeKey('error', id),
              title: (
                <span className="tree-error" title={state.error}>
                  {state.error}
                </span>
              ),
              selectable: false,
              isLeaf: true
            }
          ]
        : undefined
    if (!connectionMatches && connected && !children?.length) return []
    return [
      {
        key: nodeKey('connection', id),
        className: `connection-tree-node ${status}`,
        title: (
          <Dropdown
            trigger={['contextMenu']}
            disabled={running}
            menu={{
              items: [
                connected || state?.status === 'loading' ? { key: 'close', label: '关闭连接', icon: <CloseOutlined /> } : { key: 'open', label: '打开连接', icon: <LinkOutlined /> },
                { key: 'refresh', label: '刷新连接', icon: <ReloadOutlined />, disabled: !connected },
                { type: 'divider' },
                { key: 'edit', label: '编辑连接', icon: <EditOutlined /> },
                { key: 'delete', label: '删除连接', icon: <DeleteOutlined />, danger: true }
              ],
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation()
                connectionAction(key, id)
              }
            }}
          >
            <span className={`connection-tree-label ${status}`} title={`${connection.host}:${connection.port}${state?.error ? `\n${state.error}` : ''}`}>
              {connection.name}
            </span>
          </Dropdown>
        ),
        icon: (
          <span className={`connection-tree-icon ${status}`}>
            <EngineIcon type={connection.type} connected={connected} />
          </span>
        ),
        isLeaf: false,
        children
      }
    ]
  })
  const nodes: DataNode[] = []
  const groups = new Map<string, DataNode>()
  const connectionsById = new Map(connections.map((connection) => [connection.id, connection]))
  for (const node of connectionNodes) {
    const [, id] = JSON.parse(String(node.key)) as string[]
    const name = connectionGroupName(connectionsById.get(id)?.group)
    let group = groups.get(name)
    if (!group) {
      group = { key: nodeKey('group', name), title: <span title={name}>{name}</span>, icon: <FolderOutlined />, selectable: false, children: [] }
      groups.set(name, group)
      nodes.push(group)
      loadedKeys.push(String(group.key))
    }
    group.children!.push(node)
  }
  const expandedKeys = expanded.filter((key) => {
    const [type, id] = JSON.parse(key) as string[]
    if (type === 'group') return groups.has(id)
    return connections.some((connection) => connection.id === id) && (type === 'connection' ? Boolean(objects.snapshots[id]) : objects.snapshots[id]?.status === 'connected')
  })
  // 搜索时展开分组以显示匹配连接，不覆盖用户保存的折叠状态。
  if (search.trim()) for (const group of groups.values()) if (!expandedKeys.includes(String(group.key))) expandedKeys.push(String(group.key))
  const selectedKeys = selected.filter((key) => {
    const [type, id, db, table] = JSON.parse(key) as string[]
    const state = objects.snapshots[id]
    if (!connections.some((connection) => connection.id === id)) return false
    if (type === 'connection') return true
    if (state?.status !== 'connected' || !state.databases.includes(db)) return false
    return type === 'database' || Boolean(state.tables[db]?.some((item) => item.name === table))
  })

  return (
    <div className="explorer connection-explorer">
      <Input prefix={<SearchOutlined />} value={search} onChange={(event) => updateExplorer({ search: event.target.value })} placeholder="搜索连接 / 库 / 表" allowClear aria-label="搜索数据库对象" />
      <div className="object-tree" ref={scroll} onScroll={(event) => updateExplorer({ top: event.currentTarget.scrollTop })}>
        {!connections.length ? (
          <Empty image={<DatabaseOutlined className="empty-state-icon" />} description="暂无连接" />
        ) : (
          <Tree
            aria-label="数据库连接树"
            showIcon
            blockNode
            expandAction="doubleClick"
            disabled={running}
            treeData={nodes}
            expandedKeys={expandedKeys}
            onExpand={(keys) => updateExplorer({ expanded: keys.map(String) })}
            loadedKeys={loadedKeys}
            selectedKeys={selectedKeys}
            loadData={async (node) => {
              const [type, id, db] = JSON.parse(String(node.key)) as string[]
              if (type === 'connection') await model.openConnection(id).catch(() => {})
              else if (type === 'database') await objects.loadTables(db, id).catch(() => {})
            }}
            onDoubleClick={(_, node) => {
              if (running) return
              const [type, id, db, table] = JSON.parse(String(node.key)) as string[]
              if (type === 'database') void databaseAction('tables', id, db)
              else if (type === 'table') void tableAction('data', id, db, table)
            }}
            onSelect={(keys) => {
              if (keys.length) updateExplorer({ selected: keys.map(String) })
            }}
          />
        )}
      </div>
    </div>
  )
}
