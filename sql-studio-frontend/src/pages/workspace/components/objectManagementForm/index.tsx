import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, AutoComplete, Button, Checkbox, Form, Input, Select, Table } from 'antd'
import type { TableColumnsType } from 'antd'
import type { ReactNode } from 'react'

import { appearance } from '@/constant/appearance'
import { getDatabaseAdapter } from '@/databases'
import { ObjectAction } from '@/databases/typings/objectManagement'
import type { ThemeMode } from '@/typings/theme'

import type { useObjectManagement } from '../../hooks/useObjectManagement'
import SQLPreview from '../sqlPreview'
import TemporalInput from '../temporalInput'

type FormManager = Pick<
  ReturnType<typeof useObjectManagement>,
  'dialog' | 'form' | 'loading' | 'saving' | 'ready' | 'error' | 'collations' | 'original' | 'previewSQL' | 'fieldTypes' | 'defaultField' | 'invalidatePreview' | 'databaseDefinition'
>
type Props = { manager: FormManager; themeMode: ThemeMode }
type FormField = { name: number; key: number }
export default function ObjectManagementForm({ manager, themeMode }: Props) {
  const { dialog, form, loading, saving, ready, error, collations, original, previewSQL } = manager
  const action = dialog?.action
  const postgresDesign = Boolean(dialog && getDatabaseAdapter(dialog.connection.type).tableDesign)
  const databaseForm = action === ObjectAction.CreateDatabase || action === ObjectAction.EditDatabase
  const tableForm = action === ObjectAction.CreateTable || action === ObjectAction.EditTable
  const destructive = action === ObjectAction.DropDatabase || action === ObjectAction.DropSchema || action === ObjectAction.DropTable || action === ObjectAction.TruncateTable
  const schemaForm = action === ObjectAction.CreateSchema || action === ObjectAction.RenameSchema || action === ObjectAction.DropSchema
  const charset = Form.useWatch('charset', form)
  const targetName = (schemaForm ? dialog?.target.schema : dialog?.target.table || dialog?.target.database) || ''
  const DatabasePropertiesForm = databaseForm && dialog ? getDatabaseAdapter(dialog.connection.type).databaseEditor?.Form : undefined
  return (
    <>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
      {destructive && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={
            action === ObjectAction.TruncateTable
              ? '清空表会删除所有数据，保留表结构。此操作不可撤销。'
              : action === ObjectAction.DropSchema
                ? '仅允许删除空 Schema；包含对象时数据库会拒绝删除。'
                : action === ObjectAction.DropDatabase
                  ? '将删除整个数据库及其中的表和数据。此操作不可撤销。'
                  : dialog?.target.view
                    ? '将删除此视图定义，不会删除基础表数据。此操作不可撤销。'
                    : '将删除此对象及其数据。此操作不可撤销。'
          }
        />
      )}
      {tableForm && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={
            postgresDesign
              ? '保存会修改表结构；删除字段可能导致数据丢失。生成列暂不可编辑，依赖和类型转换由数据库校验。'
              : '保存会直接修改数据库结构；删除字段可能丢失该字段的数据。其他已有索引保留，特殊字段只读。'
          }
        />
      )}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ flex: '112px' }}
        wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }}
        labelAlign="right"
        labelWrap
        disabled={loading || saving || !ready}
        onValuesChange={manager.invalidatePreview}
      >
        {destructive ? (
          <Form.Item
            name="confirmation"
            validateFirst
            label="确认名称"
            extra={
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ userSelect: 'none' }}>输入</span>
                <span style={{ userSelect: 'all', overflowWrap: 'anywhere', whiteSpace: 'break-spaces' }}>{targetName}</span>
                <span style={{ userSelect: 'none' }}>确认</span>
              </span>
            }
            rules={[{ required: true, message: '请输入对象名称' }, { validator: (_, value) => (value === targetName ? Promise.resolve() : Promise.reject(new Error('对象名称不匹配'))) }]}
          >
            <Input autoComplete="off" placeholder={targetName} />
          </Form.Item>
        ) : (
          <Form.Item
            name="name"
            hidden={action === ObjectAction.EditTable}
            label={schemaForm ? 'Schema 名称' : databaseForm ? '数据库名称' : '表名称'}
            required={action === ObjectAction.EditDatabase ? false : undefined}
            rules={[
              { required: true, whitespace: true, message: '请输入名称' },
              { max: 64, message: '名称最多 64 个字符' }
            ]}
          >
            <Input
              disabled={loading || saving || !ready || action === ObjectAction.EditDatabase || action === ObjectAction.EditTable}
              autoComplete="off"
              placeholder={schemaForm ? '请输入 Schema 名称' : databaseForm ? '请输入数据库名称' : '请输入表名称'}
            />
          </Form.Item>
        )}
        {DatabasePropertiesForm && <DatabasePropertiesForm creating={action === ObjectAction.CreateDatabase} definition={manager.databaseDefinition} />}
        {databaseForm && dialog && getDatabaseAdapter(dialog.connection.type).objects && (
          <>
            <Form.Item name="charset" label="字符集" rules={[{ required: true }]}>
              <Select
                placeholder="请选择字符集"
                showSearch
                options={Array.from(new Set(collations.map((value) => value.charset))).map((value) => ({ value, label: value }))}
                onChange={(value) => {
                  const next = collations.find((item) => item.charset === value && item.default) || collations.find((item) => item.charset === value)
                  form.setFieldValue('collation', next?.name)
                }}
              />
            </Form.Item>
            <Form.Item
              name="collation"
              label="排序规则"
              rules={[{ required: true }]}
              extra={action === ObjectAction.EditDatabase ? '修改库默认字符集和排序规则，不转换已有表的数据或字段。' : undefined}
            >
              <Select placeholder="请选择排序规则" showSearch options={collations.filter((value) => value.charset === charset).map((value) => ({ value: value.name, label: value.name }))} />
            </Form.Item>
          </>
        )}
        {tableForm && (
          <Form.List name="fields">
            {(fields, { add, remove }) => {
              const locked = (row: FormField) => {
                const key = form.getFieldValue(['fields', row.name, 'originalName'])
                return loading || saving || !ready || Boolean(original.find((value) => value.originalName === key)?.locked)
              }
              const item = (row: FormField, key: string, child: ReactNode, required = false) => (
                <Form.Item name={[row.name, key]} style={{ margin: 0 }} rules={required ? [{ required: true, whitespace: true, message: '必填' }] : undefined}>
                  {child}
                </Form.Item>
              )
              const columns: TableColumnsType<FormField> = [
                {
                  title: '字段名',
                  width: 160,
                  render: (_, row) => (
                    <>
                      {item(row, 'name', <Input placeholder="请输入字段名" disabled={locked(row)} />, true)}
                      <Form.Item hidden name={[row.name, 'originalName']}>
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name={[row.name, 'extra']}>
                        <Input />
                      </Form.Item>
                    </>
                  )
                },
                {
                  title: '类型',
                  width: 180,
                  render: (_, row) => item(row, 'type', <AutoComplete placeholder="选择或输入字段类型" disabled={locked(row)} options={manager.fieldTypes.map((value) => ({ value }))} />, true)
                },
                ...(['nullable', 'primary', 'autoIncrement'] as const).map((key) => ({
                  title: { nullable: '允许 NULL', primary: '主键', autoIncrement: '自增' }[key],
                  width: 85,
                  render: (_: unknown, row: FormField) => (
                    <Form.Item name={[row.name, key]} valuePropName="checked" style={{ margin: 0 }}>
                      <Checkbox
                        disabled={locked(row)}
                        onChange={(event) => {
                          if (event.target.checked && (key === 'primary' || key === 'autoIncrement')) form.setFieldValue(['fields', row.name, 'nullable'], false)
                          if (event.target.checked && key === 'autoIncrement') {
                            if (!postgresDesign) form.setFieldValue(['fields', row.name, 'primary'], true)
                            form.setFieldValue(['fields', row.name, 'defaultMode'], 'none')
                          }
                          if (event.target.checked && key === 'primary' && form.getFieldValue(['fields', row.name, 'defaultMode']) === 'null')
                            form.setFieldValue(['fields', row.name, 'defaultMode'], 'none')
                        }}
                      />
                    </Form.Item>
                  )
                })),
                {
                  title: '默认值类型',
                  width: 120,
                  render: (_, row) =>
                    item(
                      row,
                      'defaultMode',
                      <Select
                        placeholder="请选择默认值类型"
                        disabled={locked(row)}
                        options={[
                          { value: 'none', label: '无默认值' },
                          { value: 'null', label: 'NULL' },
                          { value: 'literal', label: '常量' },
                          { value: 'expression', label: postgresDesign ? '表达式' : '时间表达式' }
                        ]}
                      />
                    )
                },
                {
                  title: '默认值',
                  width: 200,
                  render: (_, row) => (
                    <Form.Item noStyle shouldUpdate>
                      {() =>
                        item(
                          row,
                          'defaultValue',
                          <TemporalInput
                            placeholder="请输入默认值"
                            disabled={locked(row)}
                            label="字段默认值"
                            fieldType={form.getFieldValue(['fields', row.name, 'defaultMode']) === 'literal' ? form.getFieldValue(['fields', row.name, 'type']) : ''}
                          />
                        )
                      }
                    </Form.Item>
                  )
                },
                {
                  title: '注释',
                  width: 160,
                  render: (_, row) => item(row, 'comment', <Input placeholder="请输入注释（可选）" disabled={locked(row)} />)
                },
                {
                  title: '',
                  width: 48,
                  fixed: 'right',
                  render: (_, row) => (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={locked(row)}
                      title={locked(row) ? '特殊字段暂不支持修改或删除' : '删除字段'}
                      aria-label="删除字段"
                      onClick={() => remove(row.name)}
                    />
                  )
                }
              ]
              return (
                <>
                  <Table size={appearance.tableSize} rowKey="key" dataSource={fields} columns={columns} pagination={false} scroll={{ x: 1250 }} />
                  <Button icon={<PlusOutlined />} style={{ marginTop: 12 }} onClick={() => add(manager.defaultField())}>
                    添加字段
                  </Button>
                </>
              )
            }}
          </Form.List>
        )}
      </Form>
      {previewSQL && (
        <div style={{ marginTop: 16 }}>
          <SQLPreview compact sql={previewSQL} themeMode={themeMode} databaseType={dialog?.connection.type} />
        </div>
      )}
    </>
  )
}
