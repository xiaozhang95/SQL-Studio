import { Button, Modal, Space } from 'antd'

import { ObjectAction } from '@/databases/typings/objectManagement'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import type { useObjectManagement } from '../../hooks/useObjectManagement'
import ObjectManagementForm from '../objectManagementForm'

type Props = { manager: ReturnType<typeof useObjectManagement>; themeMode: ThemeMode }
export default function ObjectManagementModal({ manager, themeMode }: Props) {
  const { t } = useTranslation()

  const { dialog, loading, saving, ready } = manager
  const action = dialog?.action
  const tableForm = action === ObjectAction.CreateTable || action === ObjectAction.EditTable
  const destructive = action === ObjectAction.DropDatabase || action === ObjectAction.DropSchema || action === ObjectAction.DropTable || action === ObjectAction.TruncateTable
  return (
    <Modal
      title={t(manager.title)}
      open={Boolean(dialog) && !tableForm}
      width={640}
      loading={loading}
      closable={!saving}
      mask={{ closable: !saving }}
      destroyOnHidden
      onCancel={manager.close}
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      footer={
        <Space>
          <Button disabled={saving} onClick={manager.close}>
            {t('取消')}
          </Button>
          <Button disabled={!ready || saving} onClick={manager.preview}>
            {t('预览')}
          </Button>
          <Button type="default" danger={destructive} disabled={!ready || loading} loading={saving} onClick={manager.save}>
            {destructive ? t(manager.title) : t('保存')}
          </Button>
        </Space>
      }
    >
      <ObjectManagementForm manager={manager} themeMode={themeMode} />
    </Modal>
  )
}
