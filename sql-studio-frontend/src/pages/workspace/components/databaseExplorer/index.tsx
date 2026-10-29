import {
  ClearOutlined,
  CloseOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  FileTextOutlined,
  FolderOutlined,
  KeyOutlined,
  LinkOutlined,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  TableOutlined
} from '@ant-design/icons'
import { Button, Dropdown, Empty, Input, Tree } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo, useState } from 'react'

import { connectionGroupName, defaultConnectionGroup } from '@/constant/connectionGroup'
import { getDatabaseAdapter } from '@/databases'
import { ObjectAction } from '@/databases/typings/objectManagement'

import { objectTreeLayout } from '../../constant/layout'
import { useTreeViewport } from '../../hooks/useTreeViewport'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { buildExplorerTree } from '../../utils/explorerTree'
import type { ExplorerNode } from '../../utils/explorerTree'
import EngineIcon from '../engineIcon'

type Props = {
  model: Pick<
    WorkspaceModel,
    'connections' | 'connectionGroups' | 'connectionAction' | 'openConnection' | 'databaseAction' | 'tableAction' | 'openExplorerPage' | 'objects' | 'running' | 'explorer' | 'updateExplorer'
  >
}

/** 树只持有显示状态，操作始终携带节点原始范围；仅可见行创建图标和内容。 */
export default function DatabaseExplorer({ model }: Props) {
  const { connections, connectionGroups, objects, running, explorer, updateExplorer } = model
  const { expanded, selected, search } = explorer
  const [contextMenu, setContextMenu] = useState<MenuProps>()
  const data = useMemo(
    () =>
      buildExplorerTree(
        connections,
        objects.snapshots,
        expanded,
        search,
        Object.fromEntries(connections.map((connection) => [connection.id, getDatabaseAdapter(connection.type).explorer])),
        connectionGroups.groups
      ),
    [connections, objects.snapshots, expanded, search, connectionGroups.groups]
  )
  const { container: treeContainerRef, tree: treeRef, height: treeHeight, onScroll: onTreeScroll } = useTreeViewport<ExplorerNode>(explorer.top, (top) => updateExplorer({ top }), data.ready)
  const selectedKeys = selected.filter((key) => data.byKey.has(key))

  // 菜单在右键时生成，不为几千张表预建按钮、图标和闭包。
  function menuFor(node: ExplorerNode): MenuProps | undefined {
    if (node.kind === 'group')
      return {
        items: [
          { key: 'create-group', label: '新建分组', icon: <PlusOutlined />, disabled: running || connectionGroups.blocked },
          { key: 'rename-group', label: '重命名分组', icon: <EditOutlined />, disabled: running || connectionGroups.blocked || node.owner === defaultConnectionGroup }
        ],
        onClick: ({ key }) => {
          setContextMenu(undefined)
          connectionGroups.open(key === 'rename-group' ? node.owner : undefined)
        }
      }
    const { owner: id, database: db, table } = node
    const engine = getDatabaseAdapter(connections.find((connection) => connection.id === id)?.type)
    const exportDisabled = objects.snapshots[id]?.status !== 'connected' || Boolean(objects.closedDatabases[id]?.includes(db))

    let items: MenuProps['items']
    if (node.kind === 'connection') {
      const connected = objects.snapshots[id]?.status === 'connected'
      items = [
        connected || objects.snapshots[id]?.status === 'loading' ? { key: 'close', label: '关闭连接', icon: <CloseOutlined /> } : { key: 'open', label: '打开连接', icon: <LinkOutlined /> },
        { key: 'create-database', label: '新建数据库', icon: <PlusOutlined />, disabled: !connected },
        { type: 'divider' },
        { key: 'edit', label: '编辑连接', icon: <EditOutlined /> },
        {
          key: 'move-group',
          label: '移动到分组',
          icon: <FolderOutlined />,
          disabled: connectionGroups.blocked,
          children: connectionGroups.groups.map((name) => ({ key: `move-group:${name}`, label: name, disabled: connectionGroupName(node.connection?.group) === name }))
        },
        { key: 'delete', label: '删除连接', icon: <DeleteOutlined />, danger: true },
        { key: 'refresh', label: '刷新', icon: <ReloadOutlined />, disabled: !connected }
      ]
    } else if (node.kind === 'schema') {
      items = [
        { key: 'new', label: '新建查询', icon: <CodeOutlined /> },
        ...(engine.simpleObjects?.actions.includes(ObjectAction.CreateSchema)
          ? [
              { key: 'create-schema', label: '新建 Schema', icon: <PlusOutlined /> },
              { key: 'rename-schema', label: '重命名 Schema', icon: <EditOutlined /> },
              { key: 'delete-schema', label: '删除 Schema', icon: <DeleteOutlined />, danger: true }
            ]
          : []),
        { key: 'create-table', label: '新建表', icon: <PlusOutlined /> },
        { key: 'tables', label: '查看表列表', icon: <TableOutlined /> },
        {
          key: 'export',
          label: '转储文件',
          icon: <ExportOutlined />,
          disabled: exportDisabled,
          children: [
            { key: 'dump', label: '仅结构', icon: <FileTextOutlined /> },
            { key: 'dump-data', label: '结构和数据', icon: <TableOutlined /> }
          ]
        },
        { key: 'refresh', label: '刷新', icon: <ReloadOutlined /> }
      ]
    } else if (node.kind === 'database') {
      items = [
        { key: 'new', label: '新建查询', icon: <CodeOutlined /> },
        objects.closedDatabases[id]?.includes(db) ? { key: 'open', label: '打开数据库', icon: <LinkOutlined /> } : { key: 'close', label: '关闭数据库', icon: <CloseOutlined /> },
        { type: 'divider' },
        { key: 'edit', label: '编辑数据库', icon: <EditOutlined /> },
        { key: 'create', label: '新建数据库', icon: <PlusOutlined /> },
        { key: 'delete', label: '删除数据库', icon: <DeleteOutlined />, danger: true },
        { type: 'divider' },
        ...(engine.simpleObjects?.actions.includes(ObjectAction.CreateSchema) ? [{ key: 'create-schema', label: '新建 Schema', icon: <PlusOutlined /> }] : []),
        { key: 'create-table', label: '新建表', icon: <PlusOutlined /> },
        { key: 'tables', label: engine.explorer ? '查看 Schema 列表' : '查看表列表', icon: <TableOutlined /> },
        {
          key: 'export',
          label: '转储文件',
          icon: <ExportOutlined />,
          disabled: exportDisabled,
          children: [
            { key: 'dump', label: '仅结构', icon: <FileTextOutlined /> },
            { key: 'dump-data', label: '结构和数据', icon: <TableOutlined /> }
          ]
        },
        { key: 'refresh', label: '刷新', icon: <ReloadOutlined /> }
      ]
    } else if (node.kind === 'tables') {
      items = [
        { key: 'create-table', label: '新建表', icon: <PlusOutlined /> },
        { key: 'tables', label: '查看表列表', icon: <TableOutlined /> },
        { key: 'refresh', label: '刷新', icon: <ReloadOutlined /> }
      ]
    } else if (node.kind === 'table') {
      items = [
        { key: 'new', label: '新建查询', icon: <CodeOutlined /> },
        { key: 'data', label: '打开表', icon: <TableOutlined /> },
        { key: 'design', label: '设计表', icon: <EditOutlined />, disabled: node.view },
        { key: 'create', label: '新建表', icon: <PlusOutlined /> },
        { key: 'structure', label: '查询结构', icon: <ProfileOutlined /> },
        { key: 'ddl', label: '查看 DDL', icon: <FileTextOutlined /> },
        { type: 'divider' },
        { key: 'delete', label: node.view ? '删除视图' : '删除表', icon: <DeleteOutlined />, danger: true },
        { key: 'truncate', label: '清空表', icon: <ClearOutlined />, danger: true, disabled: node.view },
        { key: 'rename', label: '重命名', icon: <EditOutlined /> },
        {
          key: 'export',
          label: '转储文件',
          icon: <ExportOutlined />,
          disabled: exportDisabled,
          children: [
            { key: 'dump', label: '仅结构', icon: <FileTextOutlined /> },
            { key: 'dump-data', label: '结构和数据', icon: <TableOutlined />, disabled: node.view }
          ]
        },
        { key: 'refresh', label: '刷新', icon: <ReloadOutlined /> }
      ]
    } else return undefined
    if (!engine.objects) {
      const supported = engine.simpleObjects?.actions ?? []
      const actionForKey =
        node.kind === 'connection'
          ? { 'create-database': ObjectAction.CreateDatabase }
          : node.kind === 'database'
            ? { edit: ObjectAction.EditDatabase, create: ObjectAction.CreateDatabase, delete: ObjectAction.DropDatabase, 'create-table': ObjectAction.CreateTable }
            : node.kind === 'tables' || node.kind === 'schema'
              ? { 'create-table': ObjectAction.CreateTable }
              : { design: ObjectAction.EditTable, create: ObjectAction.CreateTable, delete: ObjectAction.DropTable, truncate: ObjectAction.TruncateTable, rename: ObjectAction.RenameTable }
      const unavailable =
        node.kind === 'connection'
          ? ['create-database']
          : node.kind === 'database'
            ? ['edit', 'create', 'delete', 'create-table']
            : node.kind === 'tables' || node.kind === 'schema'
              ? ['create-table']
              : ['design', 'create', 'delete', 'truncate', 'rename']
      items = items
        .filter(
          (item) =>
            !item ||
            !('key' in item) ||
            !unavailable.includes(String(item.key)) ||
            Boolean(node.kind === 'database' && item.key === 'edit' && engine.databaseEditor) ||
            supported.some((action) => action === actionForKey[String(item.key) as keyof typeof actionForKey]) ||
            Boolean(engine.tableDesign && ((item.key === 'create-table' && node.schema) || (node.kind === 'table' && (item.key === 'create' || item.key === 'design'))))
        )
        .map((item) =>
          item && 'key' in item && item.key === 'export' && 'children' in item
            ? { ...item, children: (item.children ?? []).filter((child) => child && 'key' in child && (child.key !== 'dump-data' || engine.dataDump)) }
            : item
        )
    }
    if (running) items = items.filter((item) => item && 'key' in item && item.key === 'close')
    if (!items.length) return undefined
    return {
      items,
      onClick: ({ key, domEvent }) => {
        domEvent.stopPropagation()
        setContextMenu(undefined)
        if (node.kind === 'connection' && key.startsWith('move-group:') && node.connection) void connectionGroups.move(node.connection, key.slice('move-group:'.length))
        else if (node.kind === 'connection') model.connectionAction(key, id)
        else if (node.kind === 'table') void model.tableAction(key, id, db, table)
        else void model.databaseAction(key, id, db, undefined, node.schema)
      }
    }
  }
  function icon(node: ExplorerNode) {
    if (node.connection) return <EngineIcon type={node.connection.type} connected={node.status === 'is-connected'} size={20} />
    if (node.primary) return <KeyOutlined style={{ color: 'var(--ant-color-warning)' }} />
    switch (node.kind) {
      case 'group':
        return <FolderOutlined />
      case 'schema':
        return <FolderOutlined />
      case 'database':
        return <DatabaseOutlined />
      case 'tables':
        return <TableOutlined />
      case 'views':
        return <EyeOutlined />
      case 'table':
        return node.view ? <EyeOutlined /> : <TableOutlined />
      case 'columns':
      case 'column':
        return <ProfileOutlined />
      case 'indexes':
      case 'index':
        return <SortAscendingOutlined />
      default:
        return null
    }
  }
  function retry(node: ExplorerNode) {
    if (node.retry === 'connection') void model.openConnection(node.owner).catch(() => {})
    else if (node.retry === 'database') void objects.loadTables(node.database, node.owner).catch(() => {})
    else if (node.retry === 'table') void objects.loadTableDetails(node.database, node.table, node.owner).catch(() => {})
  }
  function renderTitle(node: ExplorerNode) {
    // 折叠动画仍持有旧节点，此时当前 byKey 已裁剪子项；展示使用节点自身数据。
    return (
      <span
        className={node.connection ? `connection-tree-label object-context-target ${node.status}` : 'object-context-target'}
        title={node.tooltip}
        style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minHeight: 24, overflow: 'hidden', color: node.retry ? 'var(--ant-color-error-text)' : 'inherit' }}
      >
        <span className={node.connection ? `connection-tree-icon ${node.status}` : undefined} style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
          {icon(node)}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.title}</span>
        {node.retry && (
          <Button
            type="link"
            size="small"
            disabled={running}
            onClick={(event) => {
              event.stopPropagation()
              retry(node)
            }}
          >
            重试
          </Button>
        )}
      </span>
    )
  }
  return (
    <div
      className="explorer connection-explorer"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 'var(--workspace-inset) var(--workspace-inset) 0', paddingTop: 16 }}
    >
      <Input prefix={<SearchOutlined />} value={search} onChange={(event) => updateExplorer({ search: event.target.value })} placeholder="搜索连接 / 库 / 表" allowClear aria-label="搜索数据库对象" />
      <div className="object-tree" ref={treeContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 12, userSelect: 'none' }}>
        <Dropdown
          trigger={['contextMenu']}
          open={Boolean(contextMenu)}
          onOpenChange={(open) => {
            if (!open) setContextMenu(undefined)
          }}
          menu={contextMenu}
        >
          <div
            style={{ height: '100%' }}
            onContextMenuCapture={(event) => {
              setContextMenu(undefined)
              if (!(event.target as HTMLElement).closest('.ant-tree-treenode'))
                setContextMenu({
                  items: [{ key: 'create-group', label: '新建分组', icon: <PlusOutlined />, disabled: running || connectionGroups.blocked }],
                  onClick: () => {
                    setContextMenu(undefined)
                    connectionGroups.open()
                  }
                })
            }}
          >
            {!data.nodes.length && !search ? (
              <Empty image={<DatabaseOutlined className="empty-state-icon" />} description="暂无连接" />
            ) : (
              <Tree<ExplorerNode>
                ref={treeRef}
                aria-label="数据库连接树"
                showIcon={false}
                blockNode
                expandAction="doubleClick"
                autoExpandParent={false}
                virtual
                // 折叠时数据会裁剪后代，禁用依赖旧节点层级的离场动画，避免缩进先归零。
                motion={{ motionAppear: false, motionEnter: false, motionLeave: false }}
                height={treeHeight}
                itemHeight={objectTreeLayout.rowHeight}
                onScroll={onTreeScroll}
                treeData={data.nodes}
                titleRender={renderTitle}
                expandedKeys={data.expandedKeys}
                loadedKeys={data.loadedKeys}
                selectedKeys={selectedKeys}
                onExpand={(_, info) => {
                  if (!running) {
                    const next = new Set(expanded)
                    if (info.expanded) next.add(String(info.node.key))
                    else next.delete(String(info.node.key))
                    updateExplorer({ expanded: [...next] })
                  }
                }}
                loadData={async (value) => {
                  if (running) return
                  const node = data.byKey.get(String(value.key))
                  if (!node) return
                  if (node.kind === 'connection') await model.openConnection(node.owner).catch(() => {})
                  else if (node.kind === 'database') await objects.loadTables(node.database, node.owner).catch(() => {})
                  else if (node.kind === 'table') await objects.loadTableDetails(node.database, node.table, node.owner).catch(() => {})
                }}
                onDoubleClick={(event, value) => {
                  if (running) return
                  const node = data.byKey.get(String(value.key))
                  if (!node) return
                  // Tree 的双击回调携带操作前的展开状态；折叠不应新建页面。
                  if (!value.isLeaf && (value.expanded || event.shiftKey || event.metaKey || event.ctrlKey)) return
                  if (node.kind === 'database' || node.kind === 'schema') model.openExplorerPage('structure', node.owner, node.database, '', node.schema)
                  else if (node.kind === 'table')
                    model.openExplorerPage(
                      'data',
                      node.owner,
                      node.database,
                      node.table,
                      getDatabaseAdapter(connections.find((connection) => connection.id === node.owner)?.type).explorer?.tableIdentity(node.table).schema
                    )
                }}
                onRightClick={({ node: value }) => {
                  const node = data.byKey.get(String(value.key))
                  if (!node) return
                  const menu = menuFor(node)
                  if (!menu) return
                  updateExplorer({ selected: [node.key] })
                  setContextMenu(menu)
                }}
                onSelect={(keys) => {
                  if (!running && keys.length) updateExplorer({ selected: keys.map(String) })
                }}
              />
            )}
          </div>
        </Dropdown>
      </div>
    </div>
  )
}
