import { Input, Select, Space } from 'antd'

import type { Column } from '@/typings/database'

type Props = { value: unknown; column?: Column; editable: boolean; disabled: boolean; onChange: (value: string | null | undefined) => void }
/** 新增行始终显示受控表单；默认、NULL 与显式空字符串互不混淆。 */
export default function NewRowCell({ value, column, editable, disabled, onChange }: Props) {
  const mode = value === undefined ? 'default' : value === null ? 'null' : 'value'
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }} onDoubleClick={(event) => event.stopPropagation()}>
      <Input
        aria-label={(column?.name ?? '字段') + ' 新增值'}
        disabled={disabled || !editable || mode === 'null'}
        value={typeof value === 'string' ? value : ''}
        placeholder={!editable ? '数据库生成或暂不支持' : mode === 'default' ? '留空使用默认值' : '请输入值'}
        onChange={(event) => onChange(event.target.value)}
      />
      <Select
        size="small"
        placeholder="请选择值类型"
        aria-label={(column?.name ?? '字段') + ' 值类型'}
        style={{ width: '100%' }}
        disabled={disabled || !editable}
        value={mode}
        onChange={(mode) => onChange(mode === 'default' ? undefined : mode === 'null' ? null : typeof value === 'string' ? value : '')}
        options={[{ value: 'default', label: '默认值' }, { value: 'value', label: '指定值' }, ...(column?.nullable === 'YES' ? [{ value: 'null', label: 'NULL' }] : [])]}
      />
    </Space>
  )
}
