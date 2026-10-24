import { DatabaseOutlined } from '@ant-design/icons'
import { Select } from 'antd'

import type { Connection } from '@/typings/database'
import type { QueryScope } from '@/typings/workspace'

import type { useDatabaseObjects } from '../../hooks/useDatabaseObjects'
import EngineIcon from '../engineIcon'

type Props = {
  scope: QueryScope
  connections: Connection[]
  objects: ReturnType<typeof useDatabaseObjects>
  disabled: boolean
  onConnection: (id: string) => void
  onSelect: (database: string, table?: string) => void
}

/** 仅提供已加载连接和库；表选择保留在左侧树，和树共享同一份范围。 */
export default function ScopeSelects({ scope, connections, objects, disabled, onConnection, onSelect }: Props) {
  const loaded = connections.filter((connection) => objects.snapshots[connection.id]?.status === 'connected')
  return (
    <>
      <Select
        className="connection-select"
        aria-label="选择连接"
        showSearch
        optionFilterProp="searchText"
        placeholder={loaded.length ? '选择连接' : '请先展开连接'}
        value={objects.connected ? scope.connectionId : undefined}
        disabled={disabled || !loaded.length}
        onChange={onConnection}
        options={loaded.map((connection) => ({
          value: connection.id,
          searchText: connection.name,
          label: (
            <span className="connection-option">
              <EngineIcon type={connection.type} />
              <span className="connection-option-name" title={connection.name}>
                {connection.name}
              </span>
            </span>
          )
        }))}
      />
      <Select
        className="database-select"
        aria-label="选择数据库"
        prefix={<DatabaseOutlined />}
        showSearch
        optionFilterProp="label"
        allowClear
        placeholder="选择数据库"
        value={objects.connected ? scope.database || undefined : undefined}
        disabled={disabled || !objects.connected}
        onChange={(value) => onSelect(value || '')}
        options={objects.databases.map((name) => ({ value: name, label: name }))}
      />
    </>
  )
}
