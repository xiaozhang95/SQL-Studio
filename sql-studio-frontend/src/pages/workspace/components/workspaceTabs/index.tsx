import { CloseCircleOutlined, CloseOutlined, CodeOutlined, EditOutlined, FileTextOutlined, LoadingOutlined, ProfileOutlined, RightOutlined, TableOutlined } from '@ant-design/icons'
import { Dropdown, Tabs } from 'antd'
import type { ReactNode } from 'react'

import { appearance } from '@/constant/appearance'
import { DatabaseEngine } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { WorkspaceTab } from '@/typings/workspace'

import { workspaceTabLayout } from '../../constant/layout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { queryPageContext, workspacePageTitle } from '../../utils/pageTitle'

type Props = {
  model: Pick<WorkspaceModel, 'savedConnections' | 'designerDirty' | 'tabs' | 'activeTab' | 'runs' | 'tabBusy' | 'runningTabId' | 'selectTab' | 'closeTab' | 'closeTabs'>
  children: ReactNode
  renderDesigner: (page: WorkspaceTab) => ReactNode
  renderRedis: (page: WorkspaceTab, connection: Connection) => ReactNode
}
/** 主区域只保留这一层页面标签；各页内容、执行状态和关闭目标独立。 */
export default function WorkspaceTabs({ model, children, renderDesigner, renderRedis }: Props) {
  const { t } = useTranslation()

  const { savedConnections: connections, designerDirty, tabs, activeTab, runs, tabBusy: running, runningTabId, selectTab, closeTab, closeTabs } = model
  return (
    <Tabs
      className="workspace-tabs"
      styles={{ item: { width: workspaceTabLayout.width, flex: 'none' } }}
      tabBarStyle={{ margin: 0 }}
      type="editable-card"
      hideAdd
      size={appearance.navigationSize}
      tabBarGutter={4}
      activeKey={activeTab}
      onChange={selectTab}
      onEdit={(key, action) => {
        if (action === 'remove') closeTab(String(key))
      }}
      renderTabBar={(props, DefaultTabBar) => (
        <DefaultTabBar {...props}>
          {(node) => {
            const key = String(node.key)
            const index = tabs.findIndex((item) => item.id === key)
            return (
              <Dropdown
                key={key}
                trigger={['contextMenu']}
                disabled={running}
                menu={{
                  items: [
                    { key: 'current', label: t('关闭当前'), icon: <CloseOutlined /> },
                    { key: 'others', label: t('关闭其他'), icon: <CloseCircleOutlined />, disabled: tabs.length < 2 },
                    { key: 'right', label: t('关闭右侧'), icon: <RightOutlined />, disabled: index === tabs.length - 1 }
                  ],
                  onClick: ({ key: action, domEvent }) => {
                    domEvent.stopPropagation()
                    if (action === 'current' || action === 'others' || action === 'right') closeTabs(key, action)
                  }
                }}
              >
                {node}
              </Dropdown>
            )
          }}
        </DefaultTabBar>
      )}
      items={tabs.map((item) => {
        const connection = connections.find((value) => value.id === item.connectionId)
        const redis = item.kind === 'query' && connection?.type === DatabaseEngine.Redis
        const designer = item.kind === 'table-create' || item.kind === 'table-design'
        return {
          key: item.id,
          icon:
            runningTabId === item.id ? (
              <LoadingOutlined spin />
            ) : item.kind === 'table-create' || item.kind === 'table-design' ? (
              <EditOutlined />
            ) : item.kind === 'query' ? (
              <CodeOutlined />
            ) : item.kind === 'data' ? (
              <TableOutlined />
            ) : item.kind === 'ddl' ? (
              <FileTextOutlined />
            ) : (
              <ProfileOutlined />
            ),
          label: (
            <span
              style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}
              title={
                item.kind === 'table-create' || item.kind === 'table-design'
                  ? `${item.title}\n${connection?.name || ''} / ${item.database}${item.table ? ' / ' + item.table : ''}`
                  : runs[item.id]?.source || item.resultSource
                    ? `${workspacePageTitle(item)}\n${runs[item.id]?.source || item.resultSource}`
                    : workspacePageTitle(item)
              }
            >
              {queryPageContext(item) ? (
                <>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{queryPageContext(item)}</span>
                  <span style={{ flexShrink: 0, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}> · {item.title}</span>
                </>
              ) : (
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
              )}
              {designerDirty[item.id] && <span className="workspace-tab-dirty" role="img" aria-label={t('未保存')} title={t('未保存')} />}
            </span>
          ),
          closable: true,
          closeIcon: <CloseOutlined aria-disabled={running} style={{ opacity: running ? 0.35 : 1 }} />,
          destroyOnHidden: !designer && !redis,
          children: designer ? (
            renderDesigner(item)
          ) : (
            <div className="workspace-page" style={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {redis ? renderRedis(item, connection) : item.id === activeTab ? children : undefined}
            </div>
          )
        }
      })}
      style={{ flex: 1, minHeight: 0, userSelect: 'none' }}
    />
  )
}
