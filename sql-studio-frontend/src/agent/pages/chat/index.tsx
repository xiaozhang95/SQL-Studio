import { MenuOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Flex, Grid, theme } from 'antd'
import { useEffect, useMemo } from 'react'

import ContentLoading from '@/components/contentLoading'
import ErrorNotice from '@/components/errorNotice'
import PageHeader from '@/components/pageHeader'
import SaveStatus from '@/components/saveStatus'
import SectionNavigation from '@/components/sectionNavigation'
import SystemSettings from '@/components/systemSettings'
import { useTranslation } from '@/hooks/useTranslation'
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

const defaultConversationTitle = '新建会话'

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
  const { t } = useTranslation()

  const operation = useOperationMode(workspace)
  const chat = useChat(workspace, operation.mode)
  const { applyLatest } = workspace
  useEffect(() => {
    if (!chat.inFlight) applyLatest()
  }, [chat.inFlight, applyLatest])
  const ai = useAISettings()
  const sidebar = useAgentSidebar()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const mobile = screens.md === false
  const localizedDefaultTitle = t(defaultConversationTitle)
  const history = useMemo(
    () => chat.history.map((item) => (item.status === 'idle' && item.customTitle === false && item.title === defaultConversationTitle ? { ...item, title: localizedDefaultTitle } : item)),
    [chat.history, localizedDefaultTitle]
  )
  const activeTitle = history.find((i) => i.id === workspace.state.activeId)?.title ?? localizedDefaultTitle
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
        errors={[chat.error]}
        actions={
          <>
            <SaveStatus saving={workspace.ready && workspace.saving} label={t('正在保存对话…')} />
            <SystemSettings {...appearancePreferences} />
          </>
        }
      >
        {' '}
        <Button type="text" icon={<PlusOutlined />} disabled={chat.historyBusy || chat.loading} onClick={() => void chat.createNew()}>
          {localizedDefaultTitle}
        </Button>
        {mobile && <Button type="text" aria-label={t('历史会话')} icon={<MenuOutlined />} onClick={chat.showHistory} />}
        <SectionNavigation destination="workspace" onSwitch={onBack} switchDisabled={chat.historyBusy} />
      </PageHeader>
      <Flex style={{ flex: 1, minHeight: 0 }}>
        <History
          mobile={mobile}
          layout={sidebar}
          open={chat.historyOpen}
          items={history}
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
                  <ContentLoading label={t('正在加载会话…')} />
                ) : chat.loadError ? (
                  <ErrorNotice title={t('会话加载失败')} error={chat.loadError} action={<Button onClick={() => void chat.retryHistory()}>{t('重试')}</Button>} />
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
