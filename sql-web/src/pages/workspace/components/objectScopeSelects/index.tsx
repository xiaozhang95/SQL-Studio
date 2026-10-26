import { DatabaseOutlined, EyeOutlined, TableOutlined } from '@ant-design/icons'
import { Select, Space } from 'antd'
import type { ReactNode } from 'react'

import { appearance } from '@/constant/appearance'
import type { Connection } from '@/typings/database'

import EngineIcon from '../engineIcon'

type Props = { connection?: Pick<Connection, 'id' | 'name' | 'type'>; database: string; table?: string; view?: boolean; connected?: boolean }
/** 对象管理的固定范围展示；不允许更换当前草稿所属连接或对象。 */
export default function ObjectScopeSelects({ connection, database, table, view = false, connected = true }: Props) {
  const label = (icon: ReactNode, text: string) => (
    <span className="connection-option">
      {icon}
      <span className="connection-option-name" title={text}>
        {text}
      </span>
    </span>
  )
  return (
    <Space wrap size={8} style={{ maxWidth: '100%' }}>
      <Select
        aria-label="当前连接"
        placeholder="连接不可用"
        disabled
        style={{ width: appearance.selectWidth, maxWidth: '100%' }}
        value={connection?.id}
        options={connection ? [{ value: connection.id, label: label(<EngineIcon type={connection.type} connected={connected} />, connection.name) }] : []}
      />
      {database && (
        <Select
          aria-label="当前数据库"
          placeholder="请选择数据库"
          disabled
          style={{ width: appearance.selectWidth, maxWidth: '100%' }}
          value={database}
          options={[{ value: database, label: label(<DatabaseOutlined />, database) }]}
        />
      )}
      {table && (
        <Select
          aria-label={view ? '当前视图' : '当前表'}
          placeholder="请选择对象"
          disabled
          style={{ width: appearance.selectWidth, maxWidth: '100%' }}
          value={table}
          options={[{ value: table, label: label(view ? <EyeOutlined /> : <TableOutlined />, table) }]}
        />
      )}
    </Space>
  )
}
