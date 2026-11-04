import { Alert, Form, Input, Modal } from 'antd'
import type { InputRef } from 'antd'
import { useRef } from 'react'

import type { useConnectionGroups } from '../../hooks/useConnectionGroups'

type Props = { manager: ReturnType<typeof useConnectionGroups> }

export default function ConnectionGroupModal({ manager }: Props) {
  const { form, dialog, visible, saving, error, groups, close, save } = manager
  const input = useRef<InputRef>(null)
  return (
    <Modal
      forceRender
      title={dialog?.deleting ? '删除分组' : dialog?.original ? '重命名分组' : '新建分组'}
      open={visible}
      afterOpenChange={(open) => {
        if (!open) manager.afterClose()
        else if (!dialog?.deleting) input.current?.focus({ cursor: 'all' })
      }}
      onCancel={close}
      onOk={() => void save()}
      confirmLoading={saving}
      closable={!saving}
      mask={{ closable: !saving }}
      cancelButtonProps={{ disabled: saving }}
      okText={dialog?.deleting ? '删除' : '保存'}
      okButtonProps={{ danger: dialog?.deleting }}
      cancelText="取消"
    >
      <Form form={form} layout="horizontal" labelCol={{ flex: '88px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} labelAlign="right" disabled={saving}>
        <Form.Item
          name="name"
          label="分组名称"
          extra={dialog?.deleting ? '组内连接会移至默认分组；连接配置和已打开的窗口会保留。' : undefined}
          rules={[
            { required: true, whitespace: true, message: '请输入分组名称' },
            { validator: (_, value: string) => (groups.includes(value?.trim()) && value?.trim() !== dialog?.original ? Promise.reject(new Error('分组名称已存在')) : Promise.resolve()) }
          ]}
        >
          <Input
            disabled={dialog?.deleting}
            ref={input}
            placeholder="请输入分组名称"
            onPressEnter={(event) => {
              event.preventDefault()
              void save()
            }}
          />
        </Form.Item>
      </Form>
      {error && <Alert showIcon type="error" title={dialog?.deleting ? '删除分组失败' : '分组保存失败'} description={error} />}
    </Modal>
  )
}
