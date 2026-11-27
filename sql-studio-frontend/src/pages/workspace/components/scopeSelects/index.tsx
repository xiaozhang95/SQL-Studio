import { DatabaseOutlined } from '@ant-design/icons'
import { Flex, Select, theme } from 'antd'
import type { CSSProperties } from 'react'

import EngineIcon from '@/components/engineIcon'
import { getDatabaseAdapter } from '@/databases'
import { selectedRedisDatabase } from '@/databases/redis'
import { DatabaseEngine } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { QueryScope } from '@/typings/workspace'

import { queryScopeLayout, workspaceConnectionIconSize } from '../../constant/layout'
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
/** 当前查询独立选择连接与库；仅与对象树共享元数据缓存，不共享选中范围。 */
export default function ScopeSelects({ scope, connections, objects, disabled, onConnection, onSelect, onSchema }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()

  const current = connections.find((connection) => connection.id === scope.connectionId)
  const redis = current?.type === DatabaseEngine.Redis
  const service = current?.type === DatabaseEngine.Oracle
  const hasSchema = !redis && Boolean(getDatabaseAdapter(current?.type).explorer)
  const selectWidth = queryScopeLayout.width
  const selectCount = hasSchema ? 3 : 2
  const scopeWidth = selectCount * selectWidth + (selectCount - 1) * token.marginXS
  const scopeSelectStyle = { flex: '1 1 0px', minWidth: `min(${queryScopeLayout.minWidth}px, 100%)`, maxWidth: selectWidth } satisfies CSSProperties
  const databaseLabel = service ? '选择服务' : '选择数据库'
  const snapshot = objects.snapshots[scope.connectionId]
  const connected = snapshot?.status === 'connected'
  const databases = snapshot?.databases ?? []
  const database = redis ? selectedRedisDatabase(databases, scope.database, current.database) : connected ? scope.database || undefined : undefined
  return (
    <Flex align="center" gap={token.marginXS} wrap style={{ flex: `0 1 ${scopeWidth}px`, minWidth: 0 }}>
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
              <EngineIcon type={connection.type} connected={objects.snapshots[connection.id]?.status === 'connected'} size={workspaceConnectionIconSize} />
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
        aria-label={t(databaseLabel)}
        prefix={database ? undefined : <DatabaseOutlined />}
        showSearch
        optionFilterProp="searchText"
        allowClear={!redis}
        loading={snapshot?.status === 'loading'}
        placeholder={t(databaseLabel)}
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
      {hasSchema && (
        <Select
          style={scopeSelectStyle}
          aria-label={t('选择 Schema')}
          placeholder={t(service ? 'Schema（默认登录用户）' : 'Schema（默认搜索路径）')}
          allowClear
          showSearch
          disabled={disabled || !connected || !scope.database}
          value={scope.schema || undefined}
          options={(objects.snapshots[scope.connectionId]?.schemas?.[scope.database] || []).map((schema) => ({ value: schema, label: schema }))}
          onChange={(value) => onSchema(value || '')}
        />
      )}
    </Flex>
  )
}
