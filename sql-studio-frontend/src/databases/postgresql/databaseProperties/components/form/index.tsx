import { Form, Input, InputNumber } from 'antd'

import type { DatabaseDefinition } from '../../../../typings/objectManagement'

/** 新建和编辑共用属性行；新建暂只支持名称，其余属性明确展示默认值并禁用。 */
export default function DatabasePropertiesForm({ creating, definition }: { creating: boolean; definition?: DatabaseDefinition }) {
  return (
    <>
      <Form.Item label="编码">
        <Input disabled value={definition?.charset} placeholder={creating ? '使用数据库默认值' : undefined} />
      </Form.Item>
      <Form.Item label="排序规则">
        <Input disabled value={definition?.collation} placeholder={creating ? '使用数据库默认值' : undefined} />
      </Form.Item>
      <Form.Item label="字符分类">
        <Input disabled value={definition?.ctype} placeholder={creating ? '使用数据库默认值' : undefined} />
      </Form.Item>
      <Form.Item name={creating ? undefined : 'owner'} label="所有者" rules={creating ? undefined : [{ required: true, whitespace: true, message: '请输入所有者名称' }]}>
        <Input disabled={creating} autoComplete="off" placeholder={creating ? '使用数据库默认值' : '数据库所有者角色名称'} />
      </Form.Item>
      <Form.Item
        name={creating ? undefined : 'connectionLimit'}
        label="连接数上限"
        extra="-1 表示不限制；权限由数据库校验"
        rules={creating ? undefined : [{ required: true, type: 'integer', min: -1, max: 2147483647, message: '请输入 -1 至 2147483647 的整数' }]}
      >
        <InputNumber disabled={creating} placeholder={creating ? '使用数据库默认值' : undefined} min={-1} max={2147483647} precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name={creating ? undefined : 'comment'} label="注释">
        <Input.TextArea disabled={creating} rows={3} placeholder={creating ? '创建后可编辑注释' : '数据库注释（可选）'} />
      </Form.Item>
    </>
  )
}
