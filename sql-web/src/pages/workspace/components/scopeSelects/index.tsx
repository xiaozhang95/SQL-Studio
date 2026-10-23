import { DatabaseOutlined, TableOutlined } from '@ant-design/icons'
import { Select } from 'antd'

import type { QueryScope } from '@/typings/workspace'

import type { useDatabaseObjects } from '../../hooks/useDatabaseObjects'

type Props = {
  scope: QueryScope
  objects: ReturnType<typeof useDatabaseObjects>
  disabled: boolean
  onSelect: (database: string, table?: string, schema?: string) => void
}

export default function ScopeSelects({ scope, objects, disabled, onSelect }: Props) {
  return (
    <>
      <Select
        className="database-select"
        aria-label="选择数据库"
        prefix={<DatabaseOutlined />}
        showSearch
        optionFilterProp="label"
        placeholder="选择数据库"
        value={scope.database || undefined}
        loading={objects.loading}
        disabled={disabled || Boolean(objects.error)}
        onChange={(value) => onSelect(value)}
        options={objects.databases.map((name) => ({ value: name, label: name }))}
      />
      <Select
        className="table-select"
        aria-label="选择数据表"
        prefix={<TableOutlined />}
        showSearch
        optionFilterProp="label"
        allowClear
        placeholder={scope.database ? '选择数据表' : '请先选择数据库'}
        value={scope.table ? JSON.stringify([scope.schema, scope.table]) : undefined}
        labelRender={() => `${scope.schema ? `${scope.schema}.` : ''}${scope.table}`}
        loading={objects.tablesLoading}
        disabled={disabled || !scope.database || objects.tablesLoading || Boolean(objects.tableError)}
        onChange={(value) => {
          if (!value) onSelect(scope.database)
          else {
            const [schema, name] = JSON.parse(value) as string[]
            onSelect(scope.database, name, schema)
          }
        }}
        options={objects.currentTables.map((table) => ({
          value: JSON.stringify([table.schema || '', table.name]),
          label: `${table.schema ? `${table.schema}.` : ''}${table.name}`,
          title: table.comment || table.name
        }))}
      />
    </>
  )
}
