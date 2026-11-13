import { CloseCircleOutlined, CloseOutlined, CodeOutlined, EditOutlined, FileTextOutlined, LoadingOutlined, ProfileOutlined, RightOutlined, TableOutlined } from '@ant-design/icons'
import { Dropdown, Tabs } from 'antd'
import type { ReactNode } from 'react'

import { appearance } from '@/constant/appearance'
import { useTranslation } from '@/hooks/useTranslation'
import type { WorkspaceTab } from '@/typings/workspace'

import { workspaceTabLayout } from '../../constant/layout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { queryPageContext, workspacePageTitle } from '../../utils/pageTitle'

type Props = {
  model: Pick<WorkspaceModel, 'connections' | 'designerDirty' | 'tabs' | 'activeTab' | 'runs' | 'tabBusy' | 'runningTabId' | 'selectTab' | 'closeTab' | 'closeTabs'>
  children: ReactNode
  renderDesigner: (page: WorkspaceTab) => ReactNode
}
/** 主区域只保留这一层页面标签；各页内容、执行状态和关闭目标独立。 */
export default function WorkspaceTabs({ model, children, renderDesigner }: Props) {
  const { t } = useTranslation()

  const { connections, designerDirty, tabs, activeTab, runs, tabBusy: running, runningTabId, selectTab, closeTab, closeTabs } = model
  return (
    <Tabs
      className="workspace-tabs"
      styles={{ item: { width: workspaceTabLayout.width, flex: 'none', paddingInline: 'var(--workspace-inset)' } }}
      tabBarStyle={{ margin: 0, paddingInline: 'var(--ant-padding-xxs)', paddingBlockStart: 'var(--ant-padding-xxs)', background: 'var(--tab-bar-background)' }}
      type="editable-card"
      size={appearance.navigationSize}
      hideAdd
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
      items={tabs.map((item) => ({
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
                ? `${item.title}\n${connections.find((value) => value.id === item.connectionId)?.name || ''} / ${item.database}${item.table ? ' / ' + item.table : ''}`
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
            {designerDirty[item.id] && <span style={{ flex: 'none' }}> *</span>}
          </span>
        ),
        closable: true,
        closeIcon: <CloseOutlined aria-disabled={running} style={{ opacity: running ? 0.35 : 1 }} />,
        destroyOnHidden: item.kind === 'table-create' || item.kind === 'table-design' ? false : true,
        children: item.kind === 'table-create' || item.kind === 'table-design' ? renderDesigner(item) : item.id === activeTab ? children : undefined
      }))}
      style={{ flex: 1, minHeight: 0, userSelect: 'none' }}
    />
  )
}
