import { Form, Input, Modal } from 'antd'
import type { InputRef } from 'antd'
import { useRef } from 'react'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'

import type { useConnectionGroups } from '../../hooks/useConnectionGroups'

type Props = { manager: ReturnType<typeof useConnectionGroups> }

export default function ConnectionGroupModal({ manager }: Props) {
  const { t } = useTranslation()

  const { form, dialog, visible, saving, error, groups, close, save } = manager
  const input = useRef<InputRef>(null)
  return (
    <Modal
      forceRender
      title={dialog?.deleting ? t('删除分组') : dialog?.original ? t('重命名分组') : t('新建分组')}
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
      okText={dialog?.deleting ? t('删除') : t('保存')}
      okButtonProps={{ danger: dialog?.deleting }}
      cancelText={t('取消')}
    >
      <Form form={form} layout="horizontal" labelCol={{ flex: '88px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} labelAlign="right" disabled={saving}>
        <Form.Item
          name="name"
          label={t('分组名称')}
          extra={dialog?.deleting ? t('组内连接会移至默认分组；连接配置和已打开的窗口会保留。') : undefined}
          rules={[
            { required: true, whitespace: true, message: t('请输入分组名称') },
            { validator: (_, value: string) => (groups.includes(value?.trim()) && value?.trim() !== dialog?.original ? Promise.reject(new Error(t('分组名称已存在'))) : Promise.resolve()) }
          ]}
        >
          <Input
            disabled={dialog?.deleting}
            ref={input}
            placeholder={t('请输入分组名称')}
            onPressEnter={(event) => {
              event.preventDefault()
              void save()
            }}
          />
        </Form.Item>
      </Form>
      <ErrorNotice title={dialog?.deleting ? t('删除分组失败') : t('分组保存失败')} error={error} />
    </Modal>
  )
}
