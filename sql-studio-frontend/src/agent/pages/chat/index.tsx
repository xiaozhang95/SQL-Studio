import { Button, Flex, Grid, theme } from 'antd'
import { useEffect, useMemo } from 'react'

import ContentLoading from '@/components/contentLoading'
import PageErrorBanner from '@/components/pageErrorBanner'
import { useNavigationLockEffect } from '@/contexts/navigationLock'
import { useTranslation } from '@/hooks/useTranslation'

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

export function ChatPage({ dark, workspace }: { dark: boolean; workspace: WorkspaceController }) {
  const { t } = useTranslation()

  const operation = useOperationMode(workspace)
  const chat = useChat(workspace, operation.mode)
  useNavigationLockEffect(chat.historyBusy)
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
  return (
    <Flex
      component="main"
      aria-label={t('AI 助手')}
      style={{
        height: '100%',
        flexDirection: 'column',
        background: token.colorBgContainer,
        color: token.colorText,
        colorScheme: dark ? 'dark' : 'light'
      }}
    >
      <PageErrorBanner
        errors={[chat.error, chat.loadError, chat.confirmWrite.error, ai.readError, ai.choiceError]}
        errorScope={workspace.state.activeId}
        errorAction={chat.loadError ? <Button onClick={() => void chat.retryHistory()}>{t('重试')}</Button> : ai.readError ? <Button onClick={ai.retry}>{t('重试')}</Button> : undefined}
      />
      <Flex style={{ position: 'relative', flex: 1, minHeight: 0 }}>
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
          onNew={() => void chat.createNew()}
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
                {chat.loading ? null : chat.loadError ? null : chat.entries.length === 0 ? (
                  <Welcome />
                ) : (
                  <Transcript
                    key={workspace.state.activeId}
                    entries={chat.entries}
                    busy={chat.busy}
                    status={chat.status}
                    assistantModel={ai.status?.model}
                    expanded={workspace.state.expanded}
                    onExpanded={(expanded) => workspace.update({ expanded })}
                    onEdit={chat.editQuestion}
                    confirmation={chat.confirmWrite.pending && <WriteConfirmation value={chat.confirmWrite.pending} submitting={chat.confirmWrite.submitting} onDecide={chat.decideConfirmation} />}
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
                  modelPlaceholder={ai.loading ? '正在加载模型…' : ai.readError ? '读取模型配置失败' : '请选择模型'}
                  aiStatus={ai.status}
                  onSend={chat.send}
                  onStop={chat.stop}
                  onModelChange={ai.chooseModel}
                  onDraftChange={chat.onDraftChange}
                  onOpenHistory={mobile ? chat.showHistory : undefined}
                  usage={chat.usage}
                />
                <div style={{ marginTop: 6, color: 'var(--text-secondary)', textAlign: 'center' }}>{t('AI 可能出错，请核对生成的 SQL 与执行结果。')}</div>
              </div>
            </div>
          </Flex>
        </Flex>
        {chat.loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', background: 'var(--surface)' }}>
            <ContentLoading label={t('正在加载会话…')} />
          </div>
        )}
      </Flex>
    </Flex>
  )
}
