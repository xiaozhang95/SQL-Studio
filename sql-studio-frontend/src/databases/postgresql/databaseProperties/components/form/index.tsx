import { Form, Input, InputNumber } from 'antd'

import { useTranslation } from '@/hooks/useTranslation'

import type { DatabaseDefinition } from '../../../../typings/objectManagement'

/** 新建和编辑共用属性行；新建暂只支持名称，其余属性明确展示默认值并禁用。 */
export default function DatabasePropertiesForm({ creating, definition }: { creating: boolean; definition?: DatabaseDefinition }) {
  const { t } = useTranslation()

  return (
    <>
      <Form.Item label={t('编码')}>
        <Input disabled value={definition?.charset} placeholder={creating ? t('使用数据库默认值') : undefined} />
      </Form.Item>
      <Form.Item label={t('排序规则')}>
        <Input disabled value={definition?.collation} placeholder={creating ? t('使用数据库默认值') : undefined} />
      </Form.Item>
      <Form.Item label={t('字符分类')}>
        <Input disabled value={definition?.ctype} placeholder={creating ? t('使用数据库默认值') : undefined} />
      </Form.Item>
      <Form.Item name={creating ? undefined : 'owner'} label={t('所有者')} rules={creating ? undefined : [{ required: true, whitespace: true, message: t('请输入所有者名称') }]}>
        <Input disabled={creating} autoComplete="off" placeholder={creating ? t('使用数据库默认值') : t('数据库所有者角色名称')} />
      </Form.Item>
      <Form.Item
        name={creating ? undefined : 'connectionLimit'}
        label={t('连接数上限')}
        extra={t('-1 表示不限制；权限由数据库校验')}
        rules={creating ? undefined : [{ required: true, type: 'integer', min: -1, max: 2147483647, message: t('请输入 -1 至 2147483647 的整数') }]}
      >
        <InputNumber disabled={creating} placeholder={creating ? t('使用数据库默认值') : undefined} min={-1} max={2147483647} precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name={creating ? undefined : 'comment'} label={t('注释')}>
        <Input.TextArea disabled={creating} rows={3} placeholder={creating ? t('创建后可编辑注释') : t('数据库注释（可选）')} />
      </Form.Item>
    </>
  )
}
