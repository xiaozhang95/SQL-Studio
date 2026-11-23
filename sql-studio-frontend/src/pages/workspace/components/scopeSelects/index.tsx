import { DatabaseOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import type { CSSProperties } from 'react'

import EngineIcon from '@/components/engineIcon'
import { getDatabaseAdapter } from '@/databases'
import { selectedRedisDatabase } from '@/databases/redis'
import { DatabaseEngine } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { QueryScope } from '@/typings/workspace'

import type { useDatabaseObjects } from '../../hooks/useDatabaseObjects'

type Props = {
  scope: QueryScope
  connections: Connection[]
  objects: ReturnType<typeof useDatabaseObjects>
  disabled: boolean
  onSchema: (schema: string) => void
  onConnection: (id: string) => void
  onSelect: (database: string, table?: string) => void
}
const scopeSelectStyle = { flex: '0 1 240px', minWidth: 'min(190px, 100%)', maxWidth: 'min(240px, 100%)' } satisfies CSSProperties
/** 当前查询独立选择连接与库；仅与对象树共享元数据缓存，不共享选中范围。 */
export default function ScopeSelects({ scope, connections, objects, disabled, onConnection, onSelect, onSchema }: Props) {
  const { t } = useTranslation()

  const current = connections.find((connection) => connection.id === scope.connectionId)
  const redis = current?.type === DatabaseEngine.Redis
  const snapshot = objects.snapshots[scope.connectionId]
  const connected = snapshot?.status === 'connected'
  const databases = snapshot?.databases ?? []
  const database = redis ? selectedRedisDatabase(databases, scope.database, current.database) : connected ? scope.database || undefined : undefined
  return (
    <>
      <Select
        className="connection-select"
        style={scopeSelectStyle}
        aria-label={t('选择连接')}
        showSearch
        optionFilterProp="searchText"
        placeholder={t('选择连接')}
        value={current?.id}
        disabled={disabled || !connections.length}
        onChange={onConnection}
        options={connections.map((connection) => ({
          value: connection.id,
          title: connection.name,
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
        style={scopeSelectStyle}
        aria-label={t('选择数据库')}
        prefix={database ? undefined : <DatabaseOutlined />}
        showSearch
        optionFilterProp="searchText"
        allowClear={!redis}
        loading={snapshot?.status === 'loading'}
        placeholder={t('选择数据库')}
        value={database}
        disabled={disabled || !connected || (redis && current.redisMode === 'cluster')}
        onChange={(value) => onSelect(value || '')}
        options={databases.map((name) => ({
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
      {!redis && getDatabaseAdapter(current?.type).explorer && (
        <Select
          style={scopeSelectStyle}
          aria-label={t('选择 Schema')}
          placeholder={t('Schema（默认搜索路径）')}
          allowClear
          showSearch
          disabled={disabled || !connected || !scope.database}
          value={scope.schema || undefined}
          options={(objects.snapshots[scope.connectionId]?.schemas?.[scope.database] || []).map((schema) => ({ value: schema, label: schema }))}
          onChange={(value) => onSchema(value || '')}
        />
      )}
    </>
  )
}
