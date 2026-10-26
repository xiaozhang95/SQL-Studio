import { Alert, Button, Spin } from 'antd'

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
  >
}

/** 侧栏承载完整连接树，范围选择与结构缓存由工作区管理。 */
export default function ConnectionSidebar({ model, layout }: Props) {
  const { panel, visibleWidth, minimumWidth, maximumWidth, resizing, resizer } = layout
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
