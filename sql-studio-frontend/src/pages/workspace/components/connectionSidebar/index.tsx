import { PlusOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'

import ContentLoading from '@/components/contentLoading'
import { getDatabaseProfile } from '@/databases'
import type { DatabaseSection, DatabaseSectionScope } from '@/hooks/useAppSection'
import type { useSidebarResize } from '@/hooks/useSidebarResize'
import { useTranslation } from '@/hooks/useTranslation'

import type { WorkspaceModel } from '../../hooks/useWorkspace'
import DatabaseExplorer from '../databaseExplorer'

type Props = {
  layout: ReturnType<typeof useSidebarResize>
  onNewConnection: () => void
  onOpenDatabaseSection: (section: DatabaseSection, scope: DatabaseSectionScope) => void
  model: Pick<
    WorkspaceModel,
    | 'savedConnections'
    | 'connectionGroups'
    | 'connectionId'
    | 'connectionLoading'
    | 'connectionAction'
    | 'openConnection'
    | 'openRedisQuery'
    | 'databaseAction'
    | 'tableAction'
    | 'openExplorerPage'
    | 'objects'
    | 'database'
    | 'selectedTable'
    | 'selectConnection'
    | 'selectObject'
    | 'running'
    | 'explorer'
    | 'updateExplorer'
  >
}
/** 侧栏承载完整连接树，范围选择与结构缓存由工作区管理。 */
export default function ConnectionSidebar({ model, layout, onNewConnection, onOpenDatabaseSection }: Props) {
  const { t } = useTranslation()

  const { panel, visibleWidth, minimumWidth, maximumWidth, resizing, resizer } = layout
  const connected = model.savedConnections.filter((connection) => model.objects.snapshots[connection.id]?.status === 'connected').length
  const active = model.savedConnections.find((connection) => connection.id === model.connectionId)
  return (
    <aside
      ref={panel}
      className={`sidebar${resizing ? ' is-resizing' : ''}`}
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        width: visibleWidth
      }}
    >
      <div className="object-sidebar-head">
        <span className="object-sidebar-title">{t('对象')}</span>
        <span className="object-sidebar-count">{model.savedConnections.length}</span>
        <div className="object-sidebar-actions">
          <Tooltip title={t('新建连接')}>
            <Button type="text" size="small" icon={<PlusOutlined />} aria-label={t('新建连接')} disabled={model.running} onClick={onNewConnection} />
          </Tooltip>
        </div>
      </div>
      {model.connectionLoading && !model.savedConnections.length ? <ContentLoading label={t('正在加载连接…')} /> : <DatabaseExplorer model={model} onOpenDatabaseSection={onOpenDatabaseSection} />}
      <div className="object-sidebar-foot" title={active ? getDatabaseProfile(active.type).label : undefined}>
        <span className={`connection-status-dot${connected ? ' is-connected' : ''}`} />
        <span>{t('{value1} 个连接', { value1: model.savedConnections.length })}</span>
        <span className="object-sidebar-foot-sep">·</span>
        <span>{t('{value2} 个已连接', { value2: connected })}</span>
        {active && <span className="object-sidebar-foot-engine">{getDatabaseProfile(active.type).label}</span>}
      </div>
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label={t('调整数据库对象栏宽度')}
        aria-orientation="vertical"
        aria-valuemin={minimumWidth}
        aria-valuemax={maximumWidth}
        aria-valuenow={Math.round(visibleWidth)}
        aria-valuetext={t('{value1} 像素', { value1: Math.round(visibleWidth) })}
        tabIndex={0}
        {...resizer}
        style={{ position: 'absolute', insetBlock: 0, insetInlineEnd: 0, width: 5, zIndex: 3, cursor: 'col-resize', touchAction: 'none' }}
      />
    </aside>
  )
}