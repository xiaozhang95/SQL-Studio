import { CloseCircleOutlined, CloseOutlined, CodeOutlined, EditOutlined, FileTextOutlined, LoadingOutlined, PlusOutlined, ProfileOutlined, RightOutlined, StopOutlined, TableOutlined } from '@ant-design/icons'
import { Button, Dropdown, Flex, Tabs, Tooltip } from 'antd'
import type { ReactNode } from 'react'

import { DatabaseEngine } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { WorkspaceTab } from '@/typings/workspace'

import { workspaceInset, workspaceTabBarSpacer, workspaceTabBarStyle, workspaceTabLayout } from '../../constant/layout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { queryPageContext, workspacePageTitle } from '../../utils/pageTitle'
import OpenPagesMenu from './openPagesMenu'

type Props = {
  model: Pick<
    WorkspaceModel,
    | 'savedConnections'
    | 'designerDirty'
    | 'tabs'
    | 'activeTab'
    | 'runs'
    | 'tabBusy'
    | 'running'
    | 'runningTabId'
    | 'activeRunning'
    | 'workspaceReady'
    | 'newQuery'
    | 'cancelQuery'
    | 'selectTab'
    | 'closeTab'
    | 'closeTabs'
  >
  children: ReactNode
  renderDesigner: (page: WorkspaceTab) => ReactNode
  renderRedis: (page: WorkspaceTab, connection: Connection) => ReactNode
}
/** 主区域只保留这一层页面标签；各页内容、执行状态和关闭目标独立。 */
export default function WorkspaceTabs({ model, children, renderDesigner, renderRedis }: Props) {
  const { t } = useTranslation()

  const { savedConnections: connections, designerDirty, tabs, activeTab, runs, tabBusy, runningTabId, selectTab, closeTab, closeTabs } = model
  const canAdd = model.workspaceReady && !model.running
  const addLabel = t('新建查询')
  const pages = tabs.map((item) => {
    const connection = connections.find((value) => value.id === item.connectionId)
    const designer = item.kind === 'table-create' || item.kind === 'table-design'
    const icon = runningTabId === item.id ? (
      <LoadingOutlined spin />
    ) : designer ? (
      <EditOutlined />
    ) : item.kind === 'query' ? (
      <CodeOutlined />
    ) : item.kind === 'data' ? (
      <TableOutlined />
    ) : item.kind === 'ddl' ? (
      <FileTextOutlined />
    ) : (
      <ProfileOutlined />
    )
    return { item, connection, designer, icon }
  })

  return (
    <Tabs
      className="workspace-tabs"
      styles={{
        header: { ...workspaceTabBarStyle, userSelect: 'none' },
        body: { height: '100%' },
        content: { height: '100%' },
        item: {
          position: 'relative',
          width: workspaceTabLayout.width,
          height: 'var(--ant-control-height)',
          flex: 'none',
          padding: '0 10px',
          borderRadius: 'var(--ant-border-radius)'
        },
        remove: {
          display: 'inline-grid',
          placeItems: 'center',
          width: 'var(--ant-control-height)',
          height: 'var(--ant-control-height)',
          padding: 0,
          marginInlineStart: 'var(--ant-margin-xxs)',
          fontSize: 'var(--ant-font-size)'
        }
      }}
      type="editable-card"
      hideAdd={!canAdd}
      addIcon={
        <Tooltip title={addLabel}>
          <PlusOutlined />
        </Tooltip>
      }
      locale={{ addAriaLabel: addLabel, removeAriaLabel: t('关闭当前') }}
      tabBarExtraContent={{
        left: <span aria-hidden="true" style={workspaceTabBarSpacer} />,
        right: (
          <Flex align="center" gap="small" style={{ paddingInlineEnd: workspaceInset }}>
            {runningTabId && !model.activeRunning && (
              <Button type="text" danger icon={<StopOutlined />} onClick={model.cancelQuery}>
                {t('取消执行')}
              </Button>
            )}
            {pages.length > 0 && (
              <OpenPagesMenu
                pages={pages.map(({ item, connection, icon }) => ({
                  id: item.id,
                  title: item.title,
                  context: [connection?.name, item.database, item.schema, item.table].filter(Boolean).join(' / '),
                  icon,
                  dirty: designerDirty[item.id]
                }))}
                activeTab={activeTab}
                tabBusy={tabBusy}
                selectTab={selectTab}
                closeTab={closeTab}
                closeOthers={() => closeTabs(activeTab, 'others')}
              />
            )}
          </Flex>
        )
      }}
      tabBarGutter={8}
      activeKey={activeTab}
      onChange={selectTab}
      onEdit={(key, action) => {
        if (action === 'remove') closeTab(String(key))
        if (action === 'add' && canAdd) model.newQuery()
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
                disabled={tabBusy}
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
      items={pages.map(({ item, connection, designer, icon }) => {
        const redis = item.kind === 'query' && connection?.type === DatabaseEngine.Redis
        return {
          key: item.id,
          icon,
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
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>{queryPageContext(item)}</span>
                  <span style={{ flexShrink: 0, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}> · {item.title}</span>
                </>
              ) : (
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
              )}
              {designerDirty[item.id] && (
                <span style={{ width: 6, height: 6, flex: 'none', borderRadius: '50%', background: 'var(--ant-color-warning)' }} role="img" aria-label={t('未保存')} title={t('未保存')} />
              )}
            </span>
          ),
          closable: true,
          closeIcon: <CloseOutlined aria-disabled={tabBusy} style={{ opacity: tabBusy ? 0.35 : 1 }} />,
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
      style={{ flex: 1, minHeight: 0 }}
    />
  )
}
