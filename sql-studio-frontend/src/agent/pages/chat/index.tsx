import { MenuOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Flex, Grid, theme } from 'antd'

import ContentLoading from '@/components/contentLoading'
import PageHeader from '@/components/pageHeader'
import SaveStatus from '@/components/saveStatus'
import SectionNavigation from '@/components/sectionNavigation'
import SystemSettings from '@/components/systemSettings'
import type { AppearancePreferences } from '@/typings/theme'

import type { WorkspaceController } from '../../hooks/workspace'
import { Composer } from './components/composer'
import { History } from './components/history'
import { Transcript } from './components/transcript'
import { Welcome } from './components/welcome'
import { WriteConfirmation } from './components/writeConfirmation'
import { CHAT } from './constant/chat'
import { useChat } from './hooks/chat'
import { useOperationMode } from './hooks/operationMode'
import { useAISettings } from './hooks/settings'
import { useAgentSidebar } from './hooks/sidebar'

export function ChatPage({
  dark,
  workspace,
  onBack,
  ...appearancePreferences
}: AppearancePreferences & {
  dark: boolean
  workspace: WorkspaceController
  onBack: () => void
}) {
  const operation = useOperationMode(workspace)
  const chat = useChat(workspace, operation.mode)
  const ai = useAISettings()
  const sidebar = useAgentSidebar()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const mobile = screens.md === false
  const activeTitle = chat.history.find((i) => i.id === workspace.state.activeId)?.title ?? '新建会话'
  const errors = [...new Set([workspace.error, chat.error, ai.error].filter(Boolean))]
  return (
    <Flex
      style={{
        height: '100dvh',
        flexDirection: 'column',
        background: token.colorBgContainer,
        color: token.colorText,
        colorScheme: dark ? 'dark' : 'light'
      }}
    >
      <PageHeader
        showDesktopTitle={false}
        title={activeTitle}
        titleOffset={mobile ? 0 : sidebar.visibleWidth / 2}
        actions={
          <>
            {' '}
            <SaveStatus
              restoring={!workspace.ready}
              saving={workspace.saving}
              error={workspace.error}
              label="对话保存状态"
              savedText="对话保存在本机"
              savedHint="对话保存在本机，布局和草稿自动保存"
            />
            <SystemSettings themeMode={dark ? 'dark' : 'light'} {...appearancePreferences} />
          </>
        }
      >
        {' '}
        <Button type="text" icon={<PlusOutlined />} disabled={chat.historyBusy || chat.loading} onClick={() => void chat.createNew()}>
          新建会话
        </Button>
        {mobile && <Button type="text" aria-label="历史会话" icon={<MenuOutlined />} onClick={chat.showHistory} />}
        <SectionNavigation destination="workspace" onSwitch={onBack} switchDisabled={chat.historyBusy} />
      </PageHeader>
      <Flex style={{ flex: 1, minHeight: 0 }}>
        <History
          mobile={mobile}
          layout={sidebar}
          open={chat.historyOpen}
          items={chat.history}
          activeId={workspace.state.activeId}
          busy={chat.historyBusy}
          selecting={chat.loading}
          loading={chat.historyLoading}
          onClose={chat.closeHistory}
          onSelect={chat.selectHistory}
          onRefresh={chat.refreshHistory}
          onDelete={chat.deleteHistory}
          onRename={chat.renameHistory}
        />
        <Flex vertical style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <Flex vertical className="agent-conversation-column" style={{ width: '100%', flex: 1, minHeight: 0 }}>
            {errors.length > 0 && (
              <Flex vertical gap="small" role="region" aria-label="页面错误" style={{ ...CHAT.content, paddingBlock: token.paddingSM, flexShrink: 0, maxHeight: '25dvh', overflowY: 'auto' }}>
                {errors.map((error) => (
                  <Alert key={error} type="error" showIcon title={error} />
                ))}
              </Flex>
            )}
            {ai.notice && <Alert type="success" title={ai.notice} closable onClose={ai.dismissNotice} style={{ ...CHAT.content, marginBottom: token.margin }} />}
            <div
              className="chat-transcript-region"
              style={{
                padding: 0,
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                alignItems: chat.entries.length === 0 ? 'center' : 'stretch'
              }}
            >
              <div style={chat.loading || chat.entries.length ? { width: '100%', minWidth: 0, height: '100%' } : CHAT.content}>
                {chat.loading ? (
                  <ContentLoading label="正在加载会话…" />
                ) : chat.loadError ? (
                  <Alert type="error" showIcon title="会话加载失败" description={chat.loadError} action={<Button onClick={() => void chat.retryHistory()}>重试</Button>} />
                ) : chat.entries.length === 0 ? (
                  <Welcome />
                ) : (
                  <Transcript
                    key={workspace.state.activeId}
                    entries={chat.entries}
                    busy={chat.busy}
                    status={chat.status}
                    expanded={workspace.state.expanded}
                    onExpanded={(expanded) => workspace.update({ expanded })}
                    onEdit={chat.editQuestion}
                    confirmation={
                      chat.confirmWrite.pending && (
                        <WriteConfirmation value={chat.confirmWrite.pending} submitting={chat.confirmWrite.submitting} error={chat.confirmWrite.error} onDecide={chat.decideConfirmation} />
                      )
                    }
                  />
                )}
              </div>
            </div>
            <div
              style={{
                width: '100%',
                flexShrink: 0,
                overflowY: 'auto',
                scrollbarGutter: 'stable',
                paddingTop: token.paddingSM,
                paddingBottom: token.padding
              }}
            >
              <div style={CHAT.content}>
                <Composer
                  mode={operation.mode}
                  onModeChange={operation.change}
                  form={chat.form}
                  busy={chat.busy}
                  settingsBusy={ai.busy}
                  aiStatus={ai.status}
                  onSend={chat.send}
                  onStop={chat.stop}
                  onModelChange={ai.chooseModel}
                  onDraftChange={chat.onDraftChange}
                  usage={chat.usage}
                />
              </div>
            </div>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  )
}
