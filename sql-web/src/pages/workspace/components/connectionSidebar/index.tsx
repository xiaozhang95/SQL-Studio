import { Alert, Button, Spin } from 'antd'

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
  >
}

/** 侧栏承载完整连接树，范围选择与结构缓存由工作区管理。 */
export default function ConnectionSidebar({ model }: Props) {
  return (
    <aside className="sidebar">
      {model.connectionError && <Alert type="error" title="连接列表加载失败" description={model.connectionError} action={<Button onClick={() => void model.loadConnections()}>重试</Button>} />}
      {model.connectionLoading ? (
        <div className="tree-loading">
          <Spin />
        </div>
      ) : (
        <DatabaseExplorer model={model} />
      )}
    </aside>
  )
}
