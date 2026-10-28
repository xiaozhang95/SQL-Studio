import { Form, Input, InputNumber } from 'antd'

import type { DatabaseDefinition } from '../../../../typings/objectManagement'

/** 位于宿主受控 Form 内；仅展示 PostgreSQL 可编辑属性，不发起请求。 */
export default function DatabasePropertiesForm({ definition }: { definition: DatabaseDefinition }) {
  return (
    <>
      <Form.Item label="数据库名称">
        <Input readOnly value={definition.name} />
      </Form.Item>
      <Form.Item label="编码">
        <Input readOnly value={definition.charset} />
      </Form.Item>
      <Form.Item label="排序规则">
        <Input readOnly value={definition.collation} />
      </Form.Item>
      <Form.Item label="字符分类">
        <Input readOnly value={definition.ctype} />
      </Form.Item>
      <Form.Item name="owner" label="所有者" rules={[{ required: true, whitespace: true, message: '请输入所有者名称' }]}>
        <Input autoComplete="off" placeholder="数据库所有者角色名称" />
      </Form.Item>
      <Form.Item
        name="connectionLimit"
        label="连接数上限"
        extra="-1 表示不限制；权限由数据库校验"
        rules={[{ required: true, type: 'integer', min: -1, max: 2147483647, message: '请输入 -1 至 2147483647 的整数' }]}
      >
        <InputNumber min={-1} max={2147483647} precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="comment" label="注释">
        <Input.TextArea rows={3} placeholder="数据库注释（可选）" />
      </Form.Item>
    </>
  )
}
