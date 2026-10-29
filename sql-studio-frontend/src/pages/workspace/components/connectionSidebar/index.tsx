import { Spin } from 'antd'

import type { useSidebarResize } from '../../hooks/useSidebarResize'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import DatabaseExplorer from '../databaseExplorer'

type Props = {
  layout: ReturnType<typeof useSidebarResize>
  model: Pick<
    WorkspaceModel,
    | 'connections'
    | 'connectionId'
    | 'connectionLoading'
    | 'connectionAction'
    | 'openConnection'
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
export default function ConnectionSidebar({ model, layout }: Props) {
  const { panel, visibleWidth, minimumWidth, maximumWidth, resizing, resizer } = layout
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
      {model.connectionLoading && !model.connections.length ? (
        <div className="tree-loading" style={{ textAlign: 'center', padding: '28px 10px' }}>
          <Spin />
        </div>
      ) : (
        <DatabaseExplorer model={model} />
      )}
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="调整数据库对象栏宽度"
        aria-orientation="vertical"
        aria-valuemin={minimumWidth}
        aria-valuemax={maximumWidth}
        aria-valuenow={Math.round(visibleWidth)}
        aria-valuetext={`${Math.round(visibleWidth)} 像素`}
        tabIndex={0}
        {...resizer}
        style={{ position: 'absolute', insetBlock: 0, insetInlineEnd: 0, width: 5, zIndex: 3, cursor: 'col-resize', touchAction: 'none' }}
      />
    </aside>
  )
}
