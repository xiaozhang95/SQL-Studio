import { ApiOutlined, CodeOutlined, PlayCircleOutlined, ProfileOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import type { EditorView } from '@codemirror/view'
import { useRef, useState } from 'react'

import ContentLoading from '@/components/contentLoading'
import ErrorNotice from '@/components/errorNotice'
import { selectedRedisDatabase } from '@/databases/redis'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { ThemeMode } from '@/typings/theme'

import type { WorkspaceModel } from '../../hooks/useWorkspace'
import QueryToolbar from '../queryToolbar'
import ToolbarButton from '../toolbarButton'
import Console from './components/console'
import Editor from './components/editor'
import type { RedisEditorModel } from './components/editor'
import KeyBrowser from './components/keyBrowser'
import PubSub from './components/pubsub'
import { useRedisExecution } from './hooks/useRedisExecution'
import { readRedisTool, saveRedisTool } from './utils/terminalSession'

type Props = {
  model: RedisEditorModel & Pick<WorkspaceModel, 'savedConnections' | 'objects' | 'running' | 'selectConnection' | 'selectObject' | 'openConnection' | 'selectRedisDatabase'>
  connection: Connection
  active: boolean
  themeMode: ThemeMode
}

const tools = [
  { id: 'console', label: '命令行', icon: <CodeOutlined /> },
  { id: 'pubsub', label: '发布订阅', icon: <ApiOutlined /> },
  { id: 'keys', label: '键详情', icon: <ProfileOutlined /> }
] as const

export default function RedisQuery({ model, connection, active, themeMode }: Props) {
  const { t } = useTranslation()
  const [tool, setTool] = useState(() => readRedisTool(model.tab.id))
  const [commandBusy, setCommandBusy] = useState(false)
  const [pubSubOpened, setPubSubOpened] = useState(tool === 'pubsub')
  const { tab, objects } = model
  const snapshot = objects.snapshots[connection.id]
  const database = selectedRedisDatabase(snapshot?.databases ?? [], tab.database, connection.database)
  const status = snapshot?.status
  const editor = useRef<EditorView | null>(null)
  const updateDatabase = (next: number) => model.selectRedisDatabase(tab.id, connection.id, String(next))
  const execution = useRedisExecution(connection.id, updateDatabase)
  const executing = execution.status === 'running'
  const blocked = model.running || commandBusy || executing
  function run(view = editor.current) {
    if (!view || blocked || !active || database === undefined) return
    const selection = view.state.selection.main
    const draft = model.getCurrentSQL()
    void execution.execute(selection.empty ? draft : view.state.sliceDoc(selection.from, selection.to), Number(database))
  }
  return (
    <section className="editor-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>
      <QueryToolbar
        model={model}
        disabled={blocked}
        runActions={
          <>
            {tool === 'editor' && <ToolbarButton label={t('运行')} icon={<PlayCircleOutlined />} onClick={() => run()} disabled={blocked || database === undefined} />}
            {executing && <ToolbarButton label={t('取消执行')} icon={<StopOutlined />} danger onClick={execution.cancel} />}
            {status === 'error' && <ToolbarButton label={t('重试')} icon={<ReloadOutlined />} onClick={() => void model.openConnection(connection.id).catch(() => {})} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderInlineStart: '1px solid var(--border)', paddingInlineStart: 8 }} role="group" aria-label={t('Redis 查询工具')}>
              {tools.map(({ id, label, icon }) => (
                <ToolbarButton
                  key={id}
                  label={label}
                  icon={icon}
                  aria-pressed={tool === id}
                  style={tool === id ? { background: 'var(--ant-color-fill-secondary)' } : undefined}
                  onClick={() => {
                    model.getCurrentSQL()
                    const next = tool === id ? 'editor' : id
                    setTool(next)
                    saveRedisTool(tab.id, next)
                    if (id === 'pubsub') setPubSubOpened(true)
                  }}
                />
              ))}
            </div>
          </>
        }
      />
      <ErrorNotice title={t('连接加载失败')} error={snapshot?.error} />
      {database === undefined ? (
        status !== 'error' && <ContentLoading label={t('正在加载数据库…')} style={{ flex: 1, minHeight: 0 }} />
      ) : (
        <>
          <Console
            page={tab.id}
            id={connection.id}
            database={Number(database)}
            visible={active && tool === 'console'}
            blocked={model.running || executing}
            onBusy={setCommandBusy}
            onDatabase={updateDatabase}
          />
          {active && tool === 'editor' && (
            <Editor
              model={model}
              themeMode={themeMode}
              shortcutEnabled={!blocked}
              onRun={run}
              onViewChange={(view) => {
                editor.current = view
              }}
              execution={execution}
            />
          )}
          {active && tool === 'keys' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--workspace-inset)', userSelect: 'text' }}>
              <KeyBrowser key={database} id={connection.id} database={Number(database)} />
            </div>
          )}
          {pubSubOpened && (
            <div hidden={!active || tool !== 'pubsub'} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--workspace-inset)', userSelect: 'text' }}>
              <PubSub id={connection.id} />
            </div>
          )}
        </>
      )}
    </section>
  )
}
