import { Popconfirm } from 'antd'
import type { PopconfirmProps } from 'antd'

import { useTranslation } from '@/hooks/useTranslation'

/** 按钮删除共用会话列表的气泡确认；右键菜单删除由所属 Modal 承载。 */
export default function DeleteConfirmation({ okText, cancelText, ...props }: Omit<PopconfirmProps, 'okType'>) {
  const { t } = useTranslation()
  return <Popconfirm {...props} okType="default" okText={okText ?? t('删除')} cancelText={cancelText ?? t('取消')} />
}
