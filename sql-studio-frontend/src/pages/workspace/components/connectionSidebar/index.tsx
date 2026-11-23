import { PlusOutlined } from '@ant-design/icons'
import { Button, Flex, Tag, theme, Tooltip, Typography } from 'antd'

import ContentLoading from '@/components/contentLoading'
import type { DatabaseSection, DatabaseSectionScope } from '@/hooks/useAppSection'
import type { useSidebarResize } from '@/hooks/useSidebarResize'
import { useTranslation } from '@/hooks/useTranslation'

import type { WorkspaceModel } from '../../hooks/useWorkspace'
import DatabaseExplorer from '../databaseExplorer'

type Props = {
  layout: ReturnType<typeof useSidebarResize>
  onNewConnection: () => void
  onOpenDatabaseSection: (section: DatabaseSection, scope: DatabaseSectionScope) => void
  model: Pick<
    WorkspaceModel,
    | 'savedConnections'
    | 'connectionGroups'
    | 'connectionLoading'
    | 'connectionAction'
    | 'openConnection'
    | 'openRedisQuery'
    | 'databaseAction'
    | 'tableAction'
    | 'openExplorerPage'
    | 'objects'
    | 'running'
    | 'explorer'
    | 'updateExplorer'
  >
}
/** 侧栏承载完整连接树，范围选择与结构缓存由工作区管理。 */
export default function ConnectionSidebar({ model, layout, onNewConnection, onOpenDatabaseSection }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()

  const { panel, visibleWidth, minimumWidth, maximumWidth, resizing, resizer } = layout
  return (
    <aside
      ref={panel}
      className={`sidebar${resizing ? ' is-resizing' : ''}`}
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        background: token.colorBgContainer,
        borderInlineEnd: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
        width: visibleWidth,
        maxWidth: '45%'
      }}
    >
      <Flex align="center" gap="small" style={{ flex: 'none', minHeight: 42, paddingInline: token.padding, borderBlockEnd: `${token.lineWidth}px solid ${token.colorBorderSecondary}` }}>
        <Typography.Text strong>{t('对象')}</Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>{model.savedConnections.length}</Tag>
        <div style={{ marginInlineStart: 'auto' }}>
          <Tooltip title={t('新建连接')}>
            <Button type="text" size="small" icon={<PlusOutlined />} aria-label={t('新建连接')} disabled={model.running} onClick={onNewConnection} />
          </Tooltip>
        </div>
      </Flex>
      {model.connectionLoading && !model.savedConnections.length ? <ContentLoading label={t('正在加载连接…')} /> : <DatabaseExplorer model={model} onOpenDatabaseSection={onOpenDatabaseSection} />}
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label={t('调整数据库对象栏宽度')}
        aria-orientation="vertical"
        aria-valuemin={minimumWidth}
        aria-valuemax={maximumWidth}
        aria-valuenow={Math.round(visibleWidth)}
        aria-valuetext={t('{value1} 像素', { value1: Math.round(visibleWidth) })}
        tabIndex={0}
        {...resizer}
        style={{ position: 'absolute', insetBlock: 0, insetInlineEnd: 0, width: 5, zIndex: 3, cursor: 'col-resize', touchAction: 'none' }}
      />
    </aside>
  )
}
