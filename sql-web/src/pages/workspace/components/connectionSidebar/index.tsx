import { Alert, Button, Spin } from 'antd'

import { useSidebarResize } from '../../hooks/useSidebarResize'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import DatabaseExplorer from '../databaseExplorer'

type Props = {
  model: Pick<
    WorkspaceModel,
    | 'connections'
    | 'connectionId'
    | 'connectionLoading'
    | 'connectionError'
    | 'loadConnections'
    | 'connectionAction'
    | 'openConnection'
    | 'databaseAction'
    | 'tableAction'
    | 'objects'
    | 'database'
    | 'selectedTable'
    | 'selectConnection'
    | 'selectObject'
    | 'running'
    | 'explorer'
    | 'updateExplorer'
    | 'sidebarWidth'
    | 'setSidebarWidth'
  >
}

/** 侧栏承载完整连接树，范围选择与结构缓存由工作区管理。 */
export default function ConnectionSidebar({ model }: Props) {
  const { panel, visibleWidth, minimumWidth, maximumWidth, resizing, resizer } = useSidebarResize(model.sidebarWidth, model.setSidebarWidth)
  return (
    <aside ref={panel} className={`sidebar${resizing ? ' is-resizing' : ''}`} style={{ width: visibleWidth }}>
      {model.connectionError && <Alert type="error" title="连接列表加载失败" description={model.connectionError} action={<Button onClick={() => void model.loadConnections()}>重试</Button>} />}
      {model.connectionLoading ? (
        <div className="tree-loading">
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
      />
    </aside>
  )
}
