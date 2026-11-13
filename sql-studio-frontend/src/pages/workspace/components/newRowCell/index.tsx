import { Select, Space } from 'antd'

import { useTranslation } from '@/hooks/useTranslation'
import type { Column } from '@/typings/database'

import TemporalInput from '../temporalInput'

type Props = { value: unknown; column?: Column; editable: boolean; disabled: boolean; onChange: (value: string | null | undefined) => void }
/** 新增行始终显示受控表单；默认、NULL 与显式空字符串互不混淆。 */
export default function NewRowCell({ value, column, editable, disabled, onChange }: Props) {
  const { t } = useTranslation()

  const mode = value === undefined ? 'default' : value === null ? 'null' : 'value'
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }} onDoubleClick={(event) => event.stopPropagation()}>
      <TemporalInput
        label={(column?.name ?? t('字段')) + t(' 新增值')}
        fieldType={column?.type}
        disabled={disabled || !editable || mode === 'null'}
        value={typeof value === 'string' ? value : ''}
        placeholder={!editable ? t('数据库生成或暂不支持') : mode === 'default' ? t('留空使用默认值') : t('请输入值')}
        onChange={onChange}
      />
      <Select
        size="small"
        placeholder={t('请选择值类型')}
        aria-label={(column?.name ?? t('字段')) + t(' 值类型')}
        style={{ width: '100%' }}
        disabled={disabled || !editable}
        value={mode}
        onChange={(mode) => onChange(mode === 'default' ? undefined : mode === 'null' ? null : typeof value === 'string' ? value : '')}
        options={[{ value: 'default', label: t('默认值') }, { value: 'value', label: t('指定值') }, ...(column?.nullable === 'YES' ? [{ value: 'null', label: 'NULL' }] : [])]}
      />
    </Space>
  )
}
