import { ArrowLeftOutlined, MenuOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Alert, Button, Flex, Select, theme } from 'antd'

import AISettings from '@/components/aiSettings'
import PageHeader from '@/components/pageHeader'
import SaveStatus from '@/components/saveStatus'
import type { ThemePreference } from '@/typings/theme'

import type { WorkspaceController } from '../../hooks/workspace'
import { Composer } from './components/composer'
import { History } from './components/history'
import { Transcript } from './components/transcript'
import { Welcome } from './components/welcome'
import { CHAT } from './constant/chat'
import { useChat } from './hooks/chat'
import { useOperationMode } from './hooks/operationMode'
import { useAISettings } from './hooks/settings'

export function ChatPage({
  dark,
  workspace,
  onThemeChange,
  themePreference,
  onBack
}: {
  dark: boolean
  workspace: WorkspaceController
  onThemeChange: (preference: ThemePreference) => void
  themePreference: ThemePreference
  onBack: () => void
}) {
  const operation = useOperationMode(workspace)
  const chat = useChat(workspace, operation.mode)
  const ai = useAISettings()
  const { token } = theme.useToken()
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
        titleClassName="agent-header-title"
        title={activeTitle}
        actions={
          <>
            {' '}
            <span className="agent-save-status">
              <SaveStatus
                restoring={!workspace.ready}
                saving={workspace.saving}
                error={workspace.error}
                label="对话保存状态"
                savedText="对话保存在本机"
                savedHint="对话保存在本机，布局和草稿自动保存"
              />
            </span>
            <Select
              className="theme-select"
              aria-label="界面主题"
              value={themePreference}
              onChange={onThemeChange}
              prefix={dark ? <MoonOutlined /> : <SunOutlined />}
              options={[
                { value: 'system', label: '跟随系统' },
                { value: 'light', label: '亮色模式' },
                { value: 'dark', label: '暗黑模式' }
              ]}
              style={{ width: 144 }}
            />
          </>
        }
      >
        {' '}
        <Button aria-label="返回工作区" icon={<ArrowLeftOutlined />} onClick={onBack} disabled={chat.busy}>
          返回工作区
        </Button>
        <Button className="chat-history-toggle" type="text" aria-label="历史会话" icon={<MenuOutlined />} onClick={chat.showHistory} />
      </PageHeader>
      <Flex style={{ flex: 1, minHeight: 0 }}>
        <History
          open={chat.historyOpen}
          items={chat.history}
          activeId={workspace.state.activeId}
          busy={chat.busy}
          loading={chat.historyLoading}
          onClose={chat.closeHistory}
          onSelect={chat.selectHistory}
          onNew={chat.createNew}
          onRefresh={chat.refreshHistory}
          onDelete={chat.deleteHistory}
          onRename={chat.renameHistory}
        />
        <Flex vertical style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <Flex vertical className="agent-conversation-column" style={{ width: 'calc(100% - 64px)', maxWidth: CHAT.conversationMaxWidth, marginInline: 'auto', flex: 1, minHeight: 0 }}>
            {errors.length > 0 && (
              <Flex vertical gap="small" role="region" aria-label="页面错误" style={{ padding: token.paddingSM, flexShrink: 0, maxHeight: '25dvh', overflowY: 'auto' }}>
                {errors.map((error) => (
                  <Alert key={error} type="error" showIcon title={error} />
                ))}
              </Flex>
            )}
            {ai.notice && <Alert type="success" title={ai.notice} closable onClose={ai.dismissNotice} style={{ marginBottom: token.margin }} />}
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
              <div style={{ ...CHAT.content, height: chat.entries.length ? '100%' : undefined }}>
                {chat.entries.length === 0 ? (
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
                  />
                )}
              </div>
            </div>
            <div
              style={{
                width: '100%',
                paddingBottom: token.padding
              }}
            >
              <div style={CHAT.content}>
                <AISettings
                  themeMode={dark ? 'dark' : 'light'}
                  trigger={(show) => (
                    <Composer
                      mode={operation.mode}
                      onModeChange={operation.change}
                      form={chat.form}
                      busy={chat.busy}
                      settingsBusy={ai.busy}
                      aiStatus={ai.status}
                      onSend={chat.send}
                      onStop={chat.stop}
                      onConfigure={() => void show()}
                      onModelChange={ai.chooseModel}
                      onDraftChange={chat.onDraftChange}
                      usage={chat.usage}
                    />
                  )}
                />
              </div>
            </div>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  )
}
