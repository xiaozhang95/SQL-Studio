import { DatabaseOutlined, DeleteOutlined, EditOutlined, EllipsisOutlined, HistoryOutlined } from '@ant-design/icons'
import { Alert, Button, Dropdown, Select } from 'antd'

import type { WorkspaceModel } from '../../hooks/useWorkspace'
import DatabaseExplorer from '../databaseExplorer'
import EngineIcon from '../engineIcon'

type Props = {
  model: Pick<
    WorkspaceModel,
    | 'tableAction'
    | 'connections'
    | 'connectionId'
    | 'connectionLoading'
    | 'connectionError'
    | 'connection'
    | 'loadConnections'
    | 'selectConnection'
    | 'deleteConnection'
    | 'setConnectionModal'
    | 'setEditing'
    | 'objects'
    | 'database'
    | 'selectedTable'
    | 'selectedSchema'
    | 'selectObject'
    | 'refresh'
    | 'refreshSchema'
    | 'running'
    | 'setHistoryOpen'
  >
}

/** ConnectionSidebar 只负责对应区域展示，状态和业务操作由工作区 hook 提供。 */
export default function ConnectionSidebar({ model }: Props) {
  const {
    tableAction,
    connections,
    connectionId,
    connectionLoading,
    connectionError,
    connection,
    loadConnections,
    selectConnection,
    deleteConnection,
    setConnectionModal,
    setEditing,
    objects,
    database,
    selectedTable,
    selectedSchema,
    selectObject,
    refresh,
    refreshSchema,
    running,
    setHistoryOpen
  } = model

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        {connectionError ? (
          <Alert type="error" title="后端未连接" description={connectionError} action={<Button onClick={() => void loadConnections()}>重试</Button>} />
        ) : (
          <div className="connection-picker">
            <Select
              aria-label="当前连接"
              placeholder={connectionLoading ? '加载连接…' : '选择连接'}
              loading={connectionLoading}
              disabled={running}
              value={connection?.id}
              onChange={selectConnection}
              options={connections.map((c) => ({
                value: c.id,
                label: (
                  <span className="connection-option">
                    <EngineIcon type={c.type} /> {c.name}
                  </span>
                )
              }))}
            />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'edit',
                    label: '编辑连接',
                    icon: <EditOutlined />
                  },
                  {
                    key: 'delete',
                    label: '删除连接',
                    icon: <DeleteOutlined />,
                    danger: true
                  }
                ],
                onClick: ({ key }) => {
                  if (key === 'edit') {
                    setEditing(connection)
                    setConnectionModal(true)
                  } else deleteConnection()
                }
              }}
              disabled={!connection || running}
            >
              <Button icon={<EllipsisOutlined />} aria-label="连接操作" />
            </Dropdown>
          </div>
        )}
      </div>
      {connectionId ? (
        <DatabaseExplorer
          key={`${connectionId}:${refresh}:${database}`}
          connectionId={connectionId}
          database={database}
          selectedTable={selectedTable}
          selectedSchema={selectedSchema}
          onAction={tableAction}
          onSelect={selectObject}
          onRefresh={refreshSchema}
          databases={objects.databases}
          tables={objects.tables}
          loadTables={objects.loadTables}
          loading={objects.loading}
          error={objects.error}
          disabled={running}
        />
      ) : (
        <div className="sidebar-empty">
          <DatabaseOutlined />
          <p>暂无连接</p>
          <Button
            type="primary"
            onClick={() => {
              setEditing(undefined)
              setConnectionModal(true)
            }}
          >
            新建连接
          </Button>
        </div>
      )}
      <div className="sidebar-footer">
        <Button block icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
          执行历史
        </Button>
      </div>
    </aside>
  )
}
