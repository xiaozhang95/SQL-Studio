import { DatabaseOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import type { CSSProperties } from 'react'

import { appearance } from '@/constant/appearance'
import { getDatabaseAdapter } from '@/databases'
import type { Connection } from '@/typings/database'
import type { QueryScope } from '@/typings/workspace'

import type { useDatabaseObjects } from '../../hooks/useDatabaseObjects'
import EngineIcon from '../engineIcon'

type Props = {
  scope: QueryScope
  connections: Connection[]
  objects: ReturnType<typeof useDatabaseObjects>
  disabled: boolean
  onSchema: (schema: string) => void
  onConnection: (id: string) => void
  onSelect: (database: string, table?: string) => void
}
const selectorStyle = { flex: '1 1 150px', minWidth: 130, maxWidth: appearance.selectWidth } satisfies CSSProperties
/** 当前查询独立选择连接与库；仅与对象树共享元数据缓存，不共享选中范围。 */
export default function ScopeSelects({ scope, connections, objects, disabled, onConnection, onSelect, onSchema }: Props) {
  const loaded = connections.filter((connection) => objects.snapshots[connection.id]?.status === 'connected')
  return (
    <>
      <Select
        className="connection-select"
        style={selectorStyle}
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
            <span className="connection-option" style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
              <EngineIcon type={connection.type} size={20} />
              <span className="connection-option-name" title={connection.name} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {connection.name}
              </span>
            </span>
          )
        }))}
      />
      <Select
        className="database-select"
        style={selectorStyle}
        aria-label="选择数据库"
        prefix={objects.connected && scope.database ? undefined : <DatabaseOutlined />}
        showSearch
        optionFilterProp="searchText"
        allowClear
        placeholder="选择数据库"
        value={objects.connected ? scope.database || undefined : undefined}
        disabled={disabled || !objects.connected}
        onChange={(value) => onSelect(value || '')}
        options={objects.databases.map((name) => ({
          value: name,
          searchText: name,
          label: (
            <span className="connection-option" style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
              <DatabaseOutlined />
              <span className="connection-option-name" title={name} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
            </span>
          )
        }))}
      />
      {getDatabaseAdapter(connections.find((connection) => connection.id === scope.connectionId)?.type).explorer && (
        <Select
          style={selectorStyle}
          aria-label="选择 Schema"
          placeholder="Schema（默认搜索路径）"
          allowClear
          showSearch
          disabled={disabled || !objects.connected || !scope.database}
          value={scope.schema || undefined}
          options={(objects.snapshots[scope.connectionId]?.schemas?.[scope.database] || []).map((schema) => ({ value: schema, label: schema }))}
          onChange={(value) => onSchema(value || '')}
        />
      )}
    </>
  )
}
