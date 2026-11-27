import {
  ClearOutlined,
  CloseOutlined,
  CodeOutlined,
  DatabaseFilled,
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
  SortAscendingOutlined,
  TableOutlined
} from '@ant-design/icons'
import { Dropdown, Empty, Tree } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import EmptyStateIcon from '@/components/emptyStateIcon'
import EngineIcon from '@/components/engineIcon'
import { SidebarSearch } from '@/components/sidebarControls'
import StudioIcon from '@/components/studioIcon'
import { connectionGroupLabel, connectionGroupName, defaultConnectionGroup } from '@/constant/connectionGroup'
import { databaseSectionIconNames } from '@/constant/databaseSectionIcons'
import { usePageError } from '@/contexts/pageErrors'
import { getDatabaseAdapter } from '@/databases'
import { DatabaseEngine } from '@/databases/typings'
import { ObjectAction } from '@/databases/typings/objectManagement'
import type { DatabaseSection, DatabaseSectionScope } from '@/hooks/useAppSection'
import { useTranslation } from '@/hooks/useTranslation'

import { objectTreeLayout } from '../../constant/layout'
import { useTreeViewport } from '../../hooks/useTreeViewport'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { buildExplorerTree } from '../../utils/explorerTree'
import type { ExplorerNode } from '../../utils/explorerTree'
import { canExportDatabase } from '../../utils/exportAvailability'
import ToolbarButton from '../toolbarButton'

type Props = {
  onOpenDatabaseSection: (section: DatabaseSection, scope: DatabaseSectionScope) => void
  model: Pick<
    WorkspaceModel,
    | 'savedConnections'
    | 'connectionGroups'
    | 'connectionAction'
    | 'openConnection'
    | 'openRedisQuery'
    | 'databaseAction'
    | 'tableAction'
    | 'openExplorerPage'
    | 'objects'
    | 'running'
    | 'explorer'
    | 'updateExplorer'
  >
}

function ExplorerError({ error }: { error: string }) {
  usePageError(error)
  return null
}

/** 树只持有显示状态，操作始终携带节点原始范围；仅可见行创建图标和内容。 */
export default function DatabaseExplorer({ model, onOpenDatabaseSection }: Props) {
  const { t } = useTranslation()

  const { savedConnections: connections, connectionGroups, objects, running, explorer, updateExplorer } = model
  const { expanded, selected, search } = explorer
  // Keep menu content mounted while closing; the trigger alone owns its visibility.
  const [contextMenu, setContextMenu] = useState<MenuProps>({ items: [] })
  const [menuOpen, setMenuOpen] = useState(false)
  const data = useMemo(
    () =>
      buildExplorerTree(
        connections,
        objects.snapshots,
        expanded,
        search,
        Object.fromEntries(connections.filter((connection) => connection.type !== DatabaseEngine.Redis).map((connection) => [connection.id, getDatabaseAdapter(connection.type).explorer])),
        connectionGroups.groups,
        objects.closedDatabases,
        (group) => connectionGroupLabel(group, t),
        t
      ),
    [connections, objects.snapshots, objects.closedDatabases, expanded, search, connectionGroups.groups, t]
  )
  const failures = useMemo(() => Array.from(data.byKey.values()).filter((node) => node.retry && node.retry !== 'connection'), [data])
  const { container: treeContainerRef, tree: treeRef, height: treeHeight, onScroll: onTreeScroll } = useTreeViewport<ExplorerNode>(explorer.top, (top) => updateExplorer({ top }), data.ready)
  const selectedKeys = selected.filter((key) => data.byKey.has(key))
  const { loadTables, loadTableDetails } = objects
  useEffect(() => {
    if (running) return
    // 已展开的节点可能不在虚拟列表视口内，恢复布局时仍需加载其子项。
    for (const { kind, owner, database, table } of data.pendingLoads) {
      const load = kind === 'database' ? loadTables(database, owner) : loadTableDetails(database, table, owner)
      void load.catch(() => {})
    }
  }, [data.pendingLoads, running, loadTables, loadTableDetails])

  // 菜单在右键时生成，不为几千张表预建按钮、图标和闭包。
  function menuFor(node: ExplorerNode): MenuProps | undefined {
    if (node.kind === 'group')
      return {
        items: [
          { key: 'create-group', label: t('新建分组'), icon: <PlusOutlined />, disabled: running || connectionGroups.blocked },
          { key: 'rename-group', label: t('重命名分组'), icon: <EditOutlined />, disabled: running || connectionGroups.blocked || node.owner === defaultConnectionGroup },
          { key: 'delete-group', label: t('删除分组'), icon: <DeleteOutlined />, danger: true, disabled: running || connectionGroups.blocked || node.owner === defaultConnectionGroup }
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation()
          setMenuOpen(false)
          if (key === 'delete-group') connectionGroups.remove(node.owner)
          else connectionGroups.open(key === 'rename-group' ? node.owner : undefined)
        }
      }
    const { owner: id, database: db, table } = node
    if (node.kind === 'redis-database') {
      return {
        items: [{ key: 'new', label: t('新建查询'), icon: <CodeOutlined />, disabled: running }],
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          setMenuOpen(false)
          model.openRedisQuery(id, db)
        }
      }
    }
    if (node.connection?.type === DatabaseEngine.Redis) {
      if (running) return
      const status = objects.snapshots[id]?.status
      return {
        items: [
          { key: 'query', label: t('新建查询'), icon: <CodeOutlined /> },
          ...(!status || status === 'error' ? [{ key: 'open', label: t('打开连接'), icon: <LinkOutlined /> }] : []),
          ...(status ? [{ key: 'close', label: t('关闭连接'), icon: <CloseOutlined /> }] : []),
          { key: 'monitor', label: t('监控指标'), icon: <StudioIcon name={databaseSectionIconNames.monitor} /> },
          { type: 'divider' },
          { key: 'edit', label: t('编辑连接'), icon: <EditOutlined /> },
          {
            key: 'move-group',
            label: t('移动到分组'),
            icon: <FolderOutlined />,
            disabled: connectionGroups.blocked,
            children: connectionGroups.groups.map((name) => ({ key: `move-group:${name}`, label: connectionGroupLabel(name, t), disabled: connectionGroupName(node.connection?.group) === name }))
          },
          { key: 'delete', label: t('删除连接'), icon: <DeleteOutlined />, danger: true },
          { key: 'refresh', label: t('刷新'), icon: <ReloadOutlined />, disabled: status !== 'connected' }
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation()
          setMenuOpen(false)
          if (key === 'query') model.openRedisQuery(id)
          else if (key === 'monitor') onOpenDatabaseSection(key, { connectionId: id })
          else if (key.startsWith('move-group:') && node.connection) void connectionGroups.move(node.connection, key.slice('move-group:'.length))
          else model.connectionAction(key, id)
        }
      }
    }
    const engine = getDatabaseAdapter(connections.find((connection) => connection.id === id)?.type)
    const exportDisabled = !canExportDatabase(objects.snapshots[id], objects.closedDatabases[id], db)

    let items: MenuProps['items']
    if (node.kind === 'connection') {
      const status = objects.snapshots[id]?.status
      const connected = status === 'connected'
      items = [
        { key: 'create-database', label: t('新建数据库'), icon: <PlusOutlined />, disabled: !connected },
        ...(!connected && status !== 'loading' ? [{ key: 'open', label: t('打开连接'), icon: <LinkOutlined /> }] : []),
        ...(status ? [{ key: 'close', label: t('关闭连接'), icon: <CloseOutlined /> }] : []),
        { type: 'divider' },
        { key: 'monitor', label: t('监控指标'), icon: <StudioIcon name={databaseSectionIconNames.monitor} /> },
        { key: 'sync', label: t('同步数据库'), icon: <StudioIcon name={databaseSectionIconNames.sync} /> },
        { type: 'divider' },
        { key: 'edit', label: t('编辑连接'), icon: <EditOutlined /> },
        {
          key: 'move-group',
          label: t('移动到分组'),
          icon: <FolderOutlined />,
          disabled: connectionGroups.blocked,
          children: connectionGroups.groups.map((name) => ({ key: `move-group:${name}`, label: connectionGroupLabel(name, t), disabled: connectionGroupName(node.connection?.group) === name }))
        },
        { key: 'delete', label: t('删除连接'), icon: <DeleteOutlined />, danger: true },
        { key: 'refresh', label: t('刷新'), icon: <ReloadOutlined />, disabled: !connected }
      ]
    } else if (node.kind === 'schema') {
      items = [
        { key: 'new', label: t('新建查询'), icon: <CodeOutlined /> },
        ...(engine.simpleObjects?.actions.includes(ObjectAction.CreateSchema)
          ? [
              { key: 'create-schema', label: t('新建 Schema'), icon: <PlusOutlined /> },
              { key: 'rename-schema', label: t('重命名 Schema'), icon: <EditOutlined /> },
              { key: 'delete-schema', label: t('删除 Schema'), icon: <DeleteOutlined />, danger: true }
            ]
          : []),
        { key: 'create-table', label: t('新建表'), icon: <PlusOutlined /> },
        { key: 'tables', label: t('查看表列表'), icon: <TableOutlined /> },
        {
          key: 'export',
          label: t('转储文件'),
          icon: <ExportOutlined />,
          disabled: exportDisabled,
          children: [
            { key: 'dump', label: t('仅结构'), icon: <FileTextOutlined /> },
            { key: 'dump-data', label: t('结构和数据'), icon: <TableOutlined /> }
          ]
        },
        { key: 'refresh', label: t('刷新'), icon: <ReloadOutlined /> }
      ]
    } else if (node.kind === 'database') {
      items = [
        { key: 'new', label: t('新建查询'), icon: <CodeOutlined /> },
        exportDisabled ? { key: 'open', label: t('打开数据库'), icon: <LinkOutlined /> } : { key: 'close', label: t('关闭数据库'), icon: <CloseOutlined /> },
        { type: 'divider' },
        { key: 'edit', label: t('编辑数据库'), icon: <EditOutlined /> },
        { key: 'create', label: t('新建数据库'), icon: <PlusOutlined /> },
        { key: 'delete', label: t('删除数据库'), icon: <DeleteOutlined />, danger: true },
        { type: 'divider' },
        ...(engine.simpleObjects?.actions.includes(ObjectAction.CreateSchema) ? [{ key: 'create-schema', label: t('新建 Schema'), icon: <PlusOutlined /> }] : []),
        { key: 'create-table', label: t('新建表'), icon: <PlusOutlined /> },
        { key: 'tables', label: engine.explorer ? t('查看 Schema 列表') : t('查看表列表'), icon: <TableOutlined /> },
        {
          key: 'export',
          label: t('转储文件'),
          icon: <ExportOutlined />,
          disabled: exportDisabled,
          children: [
            { key: 'dump', label: t('仅结构'), icon: <FileTextOutlined /> },
            { key: 'dump-data', label: t('结构和数据'), icon: <TableOutlined /> }
          ]
        },
        { key: 'refresh', label: t('刷新'), icon: <ReloadOutlined /> }
      ]
    } else if (node.kind === 'tables') {
      items = [
        { key: 'create-table', label: t('新建表'), icon: <PlusOutlined /> },
        { key: 'tables', label: t('查看表列表'), icon: <TableOutlined /> },
        { key: 'refresh', label: t('刷新'), icon: <ReloadOutlined /> }
      ]
    } else if (node.kind === 'table') {
      items = [
        { key: 'new', label: t('新建查询'), icon: <CodeOutlined /> },
        { key: 'data', label: t('打开表'), icon: <TableOutlined /> },
        { key: 'design', label: t('设计表'), icon: <EditOutlined />, disabled: node.view },
        { key: 'create', label: t('新建表'), icon: <PlusOutlined /> },
        { key: 'structure', label: t('查询结构'), icon: <ProfileOutlined /> },
        { key: 'ddl', label: t('查看 DDL'), icon: <FileTextOutlined /> },
        { type: 'divider' },
        { key: 'delete', label: node.view ? t('删除视图') : t('删除表'), icon: <DeleteOutlined />, danger: true },
        { key: 'truncate', label: t('清空表'), icon: <ClearOutlined />, danger: true, disabled: node.view },
        { key: 'rename', label: t('重命名'), icon: <EditOutlined /> },
        {
          key: 'export',
          label: t('转储文件'),
          icon: <ExportOutlined />,
          disabled: exportDisabled,
          children: [
            { key: 'dump', label: t('仅结构'), icon: <FileTextOutlined /> },
            { key: 'dump-data', label: t('结构和数据'), icon: <TableOutlined />, disabled: node.view }
          ]
        },
        { key: 'refresh', label: t('刷新'), icon: <ReloadOutlined /> }
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
            supported.some(
              (action) =>
                action === actionForKey[String(item.key) as keyof typeof actionForKey] &&
                engine.simpleObjects?.canApply?.(action, { connectionId: id, database: db, table: node.table ?? '', schema: node.schema, view: node.view }) !== false
            ) ||
            Boolean(engine.tableDesign && ((item.key === 'create-table' && node.schema) || (node.kind === 'table' && (item.key === 'create' || item.key === 'design'))))
        )
        .map((item) =>
          item && 'key' in item && item.key === 'export' && 'children' in item
            ? { ...item, children: (item.children ?? []).filter((child) => child && 'key' in child && (child.key !== 'dump-data' || engine.dataDump)) }
            : item
        )
    }
    if (!engine.dumpFile) items = items.filter((item) => item && (!('key' in item) || item.key !== 'export'))
    if (running) items = items.filter((item) => item && 'key' in item && item.key === 'close')
    if (!items.length) return undefined
    return {
      items,
      onClick: ({ key, domEvent }) => {
        domEvent.stopPropagation()
        setMenuOpen(false)
        if (node.kind === 'connection' && key.startsWith('move-group:') && node.connection) void connectionGroups.move(node.connection, key.slice('move-group:'.length))
        else if (node.kind === 'connection' && (key === 'monitor' || key === 'sync')) onOpenDatabaseSection(key, { connectionId: id })
        else if (node.kind === 'connection') model.connectionAction(key, id)
        else if (node.kind === 'table') void model.tableAction(key, id, db, table)
        else void model.databaseAction(key, id, db, undefined, node.schema)
      }
    }
  }
  function icon(node: ExplorerNode) {
    if (node.connection) return <EngineIcon type={node.connection.type} connected={node.status === 'is-connected'} size={18} />
    if (node.primary) return <KeyOutlined style={{ color: 'var(--ant-color-warning)' }} />
    switch (node.kind) {
      case 'group':
      case 'schema':
        return <FolderOutlined />
      case 'redis-database':
        return <DatabaseFilled style={{ color: 'var(--inactive-icon)' }} />
      case 'database':
        return (
          <DatabaseFilled
            aria-label={
              node.databaseState === 'open' ? t('数据库已打开') : node.databaseState === 'opening' ? t('数据库正在打开') : node.databaseState === 'error' ? t('数据库打开失败') : t('数据库未打开')
            }
            style={{
              color: node.databaseState === 'open' || node.databaseState === 'opening' ? 'var(--primary)' : node.databaseState === 'error' ? 'var(--ant-color-error)' : 'var(--inactive-icon)'
            }}
          />
        )
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
      case 'foreign-keys':
      case 'foreign-key':
        return <LinkOutlined />
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
    const connectionFailure = node.retry === 'connection'
    const generated = node.kind.startsWith('empty-') || ['tables', 'views', 'columns', 'indexes', 'foreign-keys', 'error', 'detail-error', 'foreign-keys-error'].includes(node.kind)
    const title = node.retry && !connectionFailure ? t('加载失败') : node.kind === 'group' ? connectionGroupLabel(node.title, t) : generated ? t(node.title) : node.title
    // 折叠动画仍持有旧节点，此时当前 byKey 已裁剪子项；展示使用节点自身数据。
    return (
      <span
        className={node.connection ? `connection-tree-label object-context-target ${node.status}` : 'object-context-target'}
        title={connectionFailure ? undefined : node.kind === 'group' ? title : generated && node.tooltip ? t(node.tooltip) : node.tooltip}
        style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minHeight: 24, overflow: 'hidden', color: node.retry ? 'var(--ant-color-error-text)' : 'inherit' }}
      >
        <span className={node.connection ? `tree-node-icon connection-tree-icon ${node.status}` : 'tree-node-icon'} style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
          {icon(node)}
        </span>
        <span title={connectionFailure ? title : undefined} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </span>
        {node.retry && (
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>
            <ToolbarButton
              label={t(connectionFailure ? '重试连接' : '重试加载')}
              icon={<ReloadOutlined />}
              disabled={running}
              onClick={(event) => {
                event.stopPropagation()
                retry(node)
              }}
            />
          </span>
        )}
      </span>
    )
  }
  return (
    <div className="explorer connection-explorer" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {failures.map((node) => (
        <ExplorerError key={node.key} error={node.title} />
      ))}
      <SidebarSearch value={search} onChange={(value) => updateExplorer({ search: value })} placeholder={t('搜索连接 / 库 / 表')} label={t('搜索数据库对象')} />
      <div className="object-tree" ref={treeContainerRef} style={{ flex: 1, minHeight: 0, marginBlockStart: 'var(--ant-padding-xxs)', overflow: 'hidden', userSelect: 'none' }}>
        <Dropdown trigger={['contextMenu']} open={menuOpen} onOpenChange={setMenuOpen} menu={contextMenu}>
          <div
            style={{ height: '100%' }}
            onContextMenuCapture={(event) => {
              if (!(event.target as HTMLElement).closest('.ant-tree-treenode'))
                setContextMenu({
                  items: [{ key: 'create-group', label: t('新建分组'), icon: <PlusOutlined />, disabled: running || connectionGroups.blocked }],
                  onClick: ({ domEvent }) => {
                    domEvent.stopPropagation()
                    setMenuOpen(false)
                    connectionGroups.open()
                  }
                })
            }}
          >
            {!data.nodes.length && !search ? (
              <Empty
                image={
                  <EmptyStateIcon>
                    <DatabaseOutlined />
                  </EmptyStateIcon>
                }
                description={t('暂无连接')}
              />
            ) : (
              <Tree<ExplorerNode>
                disabled={running}
                styles={{ root: { background: 'transparent' }, itemTitle: { display: 'block', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }}
                ref={treeRef}
                aria-label={t('数据库连接树')}
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
                  if (node?.kind === 'redis-database') {
                    model.openRedisQuery(node.owner, node.database)
                    return
                  }
                  // 连接、数据库和分类节点由树本身处理展开与收起。
                  if (!node || !['schema', 'table'].includes(node.kind)) return
                  // Tree 的双击回调携带操作前的展开状态；折叠不应新建页面。
                  if (!value.isLeaf && (value.expanded || event.shiftKey || event.metaKey || event.ctrlKey)) return
                  if (node.kind === 'schema') model.openExplorerPage('structure', node.owner, node.database, '', node.schema)
                  else if (node.kind === 'table')
                    model.openExplorerPage(
                      'data',
                      node.owner,
                      node.database,
                      node.table,
                      getDatabaseAdapter(connections.find((connection) => connection.id === node.owner)?.type).explorer?.tableIdentity(node.table).schema
                    )
                }}
                onRightClick={({ event, node: value }) => {
                  const node = data.byKey.get(String(value.key))
                  if (!node) return
                  const menu = menuFor(node)
                  if (!menu) {
                    setMenuOpen(false)
                    event.stopPropagation()
                    return
                  }
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
