import { CloseCircleOutlined, CloseOutlined, CodeOutlined, FileTextOutlined, LoadingOutlined, ProfileOutlined, RightOutlined, TableOutlined } from '@ant-design/icons'
import { Dropdown, Tabs } from 'antd'
import type { ReactNode } from 'react'

import type { WorkspaceModel } from '../../hooks/useWorkspace'

type Props = {
  model: Pick<WorkspaceModel, 'tabs' | 'activeTab' | 'runs' | 'resultViews' | 'running' | 'runningTabId' | 'selectTab' | 'closeTab' | 'closeTabs'>
  children: ReactNode
}

/** 主区域只保留这一层页面标签；各页内容、执行状态和关闭目标独立。 */
export default function WorkspaceTabs({ model, children }: Props) {
  const { tabs, activeTab, runs, resultViews, running, runningTabId, selectTab, closeTab, closeTabs } = model
  const selectedRun = (id: string) => runs[id]?.statements?.[resultViews[id]?.resultIndex || 0] || runs[id]
  return (
    <Tabs
      className="workspace-tabs page-tabs"
      tabBarGutter={0}
      type="editable-card"
      size="small"
      hideAdd
      destroyOnHidden
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
                    { key: 'current', label: '关闭当前', icon: <CloseOutlined /> },
                    { key: 'others', label: '关闭其他', icon: <CloseCircleOutlined />, disabled: tabs.length < 2 },
                    { key: 'right', label: '关闭右侧', icon: <RightOutlined />, disabled: index === tabs.length - 1 }
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
            className={`result-tab-label${selectedRun(item.id)?.error ? ' is-error' : selectedRun(item.id)?.result ? ' is-success' : ''}`}
            title={runs[item.id]?.source ? `${item.title}\n${runs[item.id].source}` : item.title}
          >
            {item.title}
          </span>
        ),
        closable: !running,
        children: item.id === activeTab ? children : undefined
      }))}
    />
  )
}
