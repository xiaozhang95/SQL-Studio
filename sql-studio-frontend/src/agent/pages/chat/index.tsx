import { ArrowLeftOutlined, MenuOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Alert, Button, Flex, Select, Space, theme, Typography } from 'antd'

import type { ThemePreference } from '@/typings/theme'

import type { WorkspaceController } from '../../hooks/workspace'
import { Composer } from './components/composer'
import { History } from './components/history'
import { ModelSettings } from './components/settings'
import { Transcript } from './components/transcript'
import { Welcome } from './components/welcome'
import { CHAT } from './constant/chat'
import { useChat } from './hooks/chat'
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
  const chat = useChat(workspace)
  const ai = useAISettings()
  const { token } = theme.useToken()
  const activeTitle = chat.history.find((i) => i.id === workspace.state.activeId)?.title ?? '新建会话'
  return (
    <Flex
      style={{
        height: '100dvh',
        background: token.colorBgContainer,
        color: token.colorText,
        colorScheme: dark ? 'dark' : 'light'
      }}
    >
      <History
        open={chat.historyOpen}
        items={chat.history}
        activeId={workspace.state.activeId}
        busy={chat.busy}
        loading={chat.historyLoading}
        onClose={chat.closeHistory}
        onSelect={chat.selectHistory}
        onNew={chat.clear}
        onRefresh={chat.refreshHistory}
        onDelete={chat.deleteHistory}
      />
      <Flex vertical style={{ flex: 1, minWidth: 0 }}>
        <Flex
          justify="space-between"
          align="center"
          gap="small"
          style={{
            paddingInline: token.padding,
            minHeight: CHAT.headerHeight,
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}
        >
          <Flex align="center" gap="small" style={{ flex: 1, minWidth: 0 }}>
            <Button type="text" aria-label="返回SQL工作区" icon={<ArrowLeftOutlined />} onClick={onBack} disabled={chat.busy} />
            <Button className="chat-history-toggle" type="text" aria-label="历史会话" icon={<MenuOutlined />} style={{ flexShrink: 0 }} onClick={chat.showHistory} />
            <Typography.Text ellipsis style={{ flex: 1, minWidth: 0 }}>
              {activeTitle}
            </Typography.Text>
          </Flex>
          <Space size="small" style={{ flexShrink: 0 }}>
            <Select
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
          </Space>
        </Flex>
        <div
          className="chat-scroll"
          style={{
            padding: token.padding,
            display: 'flex',
            alignItems: chat.entries.length === 0 ? 'center' : 'stretch'
          }}
        >
          <div style={CHAT.content}>
            {(workspace.error || chat.error) && <Alert type="error" title={workspace.error || chat.error} style={{ marginBottom: token.margin }} />}
            {ai.notice && <Alert type="success" title={ai.notice} closable onClose={ai.dismissNotice} style={{ marginBottom: token.margin }} />}
            {ai.error && !ai.open && (
              <Alert
                type="error"
                title={ai.error}
                action={
                  <Button size="small" onClick={ai.show}>
                    设置
                  </Button>
                }
                style={{ marginBottom: token.margin }}
              />
            )}
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
              />
            )}
          </div>
        </div>
        <div style={{ paddingInline: token.padding, paddingBottom: token.padding }}>
          <div style={CHAT.content}>
            <Composer
              form={chat.form}
              busy={chat.busy}
              settingsBusy={ai.busy}
              aiStatus={ai.status}
              onSend={chat.send}
              onStop={chat.stop}
              onConfigure={ai.show}
              onModelChange={ai.chooseModel}
              onDraftChange={chat.onDraftChange}
              usage={chat.usage}
            />
          </div>
        </div>
      </Flex>
      <ModelSettings open={ai.open} busy={ai.busy} error={ai.error} status={ai.status} form={ai.form} onClose={ai.close} onSave={ai.save} onClear={ai.clear} />
    </Flex>
  )
}
