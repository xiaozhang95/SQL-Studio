import { Alert, Form, Input, Modal } from 'antd'

import type { useConnectionGroups } from '../../hooks/useConnectionGroups'

type Props = { manager: ReturnType<typeof useConnectionGroups> }

export default function ConnectionGroupModal({ manager }: Props) {
  const { form, dialog, saving, error, groups, close, save } = manager
  return (
    <Modal
      forceRender
      title={dialog?.original ? '重命名分组' : '新建分组'}
      open={Boolean(dialog)}
      onCancel={close}
      onOk={() => void save()}
      confirmLoading={saving}
      closable={!saving}
      mask={{ closable: !saving }}
      cancelButtonProps={{ disabled: saving }}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="horizontal" labelCol={{ flex: '88px' }} wrapperCol={{ flex: 'auto' }} disabled={saving}>
        <Form.Item
          name="name"
          label="分组名称"
          rules={[
            { required: true, whitespace: true, message: '请输入分组名称' },
            { validator: (_, value: string) => (groups.includes(value?.trim()) && value?.trim() !== dialog?.original ? Promise.reject(new Error('分组名称已存在')) : Promise.resolve()) }
          ]}
        >
          <Input
            autoFocus
            placeholder="请输入分组名称"
            onPressEnter={(event) => {
              event.preventDefault()
              void save()
            }}
          />
        </Form.Item>
      </Form>
      {error && <Alert showIcon type="error" title="分组保存失败" description={error} />}
    </Modal>
  )
}
