import { EyeOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, Space, Spin, theme, Typography } from 'antd'

import { appearance } from '@/constant/appearance'
import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import { useTableDesigner } from '../../hooks/useTableDesigner'
import type { TableDesignerOptions } from '../../hooks/useTableDesigner'
import ObjectManagementForm from '../objectManagementForm'
import ToolbarButton from '../toolbarButton'

type Props = TableDesignerOptions & {
  themeMode: ThemeMode
  available: boolean
  active: boolean
}
export default function TableDesigner({ themeMode, available, active, ...options }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()

  const manager = useTableDesigner(options)
  usePageError(active ? manager.error : undefined)
  usePageError(active ? manager.refreshError : undefined)
  return (
    <section className="workspace-page" aria-label={t('表设计工作区')} style={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div
        className="editor-toolbar"
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: token.marginXS,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          minHeight: appearance.panelHeaderHeight,
          paddingInline: token.padding,
          borderBlockEnd: `${token.lineWidth}px solid var(--layout-divider)`,
          userSelect: 'none'
        }}
      >
        <Space wrap size={token.marginXXS}>
          <ToolbarButton label={t('保存表结构')} icon={<SaveOutlined />} loading={manager.saving} disabled={!manager.ready || manager.loading || options.blocked} onClick={manager.save} />
          <ToolbarButton label={t('预览 SQL')} icon={<EyeOutlined />} disabled={!manager.ready || manager.loading || manager.saving || options.blocked} onClick={manager.preview} />
          <ToolbarButton label={t('重新加载表结构')} icon={<ReloadOutlined />} disabled={manager.loading || manager.saving || options.blocked} onClick={manager.reload} />
          {manager.dirty && <Typography.Text type="secondary">{t('未保存')}</Typography.Text>}
        </Space>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--workspace-inset)' }}>
        {!available && <Alert type="warning" showIcon title={t('连接未打开，请重新打开连接后保存。')} style={{ marginBottom: 12 }} />}
        <Spin spinning={manager.loading}>
          <ObjectManagementForm manager={manager} themeMode={themeMode} showErrors={false} />
        </Spin>
      </div>
    </section>
  )
}
