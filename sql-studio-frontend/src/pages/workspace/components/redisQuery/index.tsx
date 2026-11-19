import { CodeOutlined, DownloadOutlined, HistoryOutlined, IdcardOutlined, PlayCircleOutlined, ReloadOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons'
import { Upload } from 'antd'
import { useRef, useState } from 'react'

import ContentLoading from '@/components/contentLoading'
import { usePageError } from '@/contexts/pageErrors'
import { selectedRedisDatabase } from '@/databases/redis'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { ThemeMode } from '@/typings/theme'
import type { HistoryItem } from '@/typings/workspace'

import { useSQLImport } from '../../hooks/useSQLImport'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import QueryHistory from '../queryHistory'
import QueryResults from '../queryResults'
import QueryToolbar from '../queryToolbar'
import ToolbarButton from '../toolbarButton'
import Console from './components/console'
import Editor from './components/editor'
import KeyBrowser from './components/keyBrowser'
import PubSub from './components/pubsub'
import PubSubIcon from './components/pubsubIcon'
import { readRedisTool, saveRedisTool } from './utils/terminalSession'

type Props = { model: WorkspaceModel; connection: Connection; active: boolean; themeMode: ThemeMode }

const tools = [
  { id: 'keys', label: '键详情', icon: <IdcardOutlined /> },
  { id: 'console', label: '命令行', icon: <CodeOutlined /> },
  { id: 'pubsub', label: '发布订阅', icon: <PubSubIcon /> }
] as const

export default function RedisQuery({ model, connection, active, themeMode }: Props) {
  const { t } = useTranslation()
  const [tool, setTool] = useState(() => readRedisTool(model.tab.id))
  const [commandBusy, setCommandBusy] = useState(false)
  const [pubSubOpened, setPubSubOpened] = useState(tool === 'pubsub')
  const [loadedCommand, setLoadedCommand] = useState<HistoryItem>()
  const historyLoad = useRef<HistoryItem | undefined>(undefined)
  const [hasText, setHasText] = useState(Boolean(model.tab.sql.trim()))
  const { tab, objects } = model
  const snapshot = objects.snapshots[connection.id]
  const database = selectedRedisDatabase(snapshot?.databases ?? [], tab.database, connection.database)
  const status = snapshot?.status
  const blocked = model.running || commandBusy
  const editorMode = tool === 'editor'
  const consoleMode = tool === 'console'
  const { beforeImport, importing, error: importError } = useSQLImport((script, title) => model.addTab(script, { connectionId: connection.id, database: database ?? '', table: '' }, title))
  usePageError(active ? snapshot?.error : undefined)
  usePageError(active ? importError : undefined)

  return (
    <section className="editor-panel redis-query-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>
      <QueryToolbar
        model={model}
        compact
        disabled={blocked}
        runActions={
          <>
            {editorMode && <ToolbarButton label={t('运行')} icon={<PlayCircleOutlined />} onClick={model.runSQL} disabled={blocked || database === undefined} />}
            {model.activeRunning && <ToolbarButton label={t('取消执行')} icon={<StopOutlined />} danger onClick={model.cancelQuery} />}
            {status === 'error' && <ToolbarButton label={t('重试')} icon={<ReloadOutlined />} onClick={() => void model.openConnection(connection.id).catch(() => {})} />}
          </>
        }
      >
        <div className="query-toolbar-group" role="group" aria-label={t('Redis 查询工具')}>
          {tools.map(({ id, label, icon }) => (
            <ToolbarButton
              key={id}
              label={label}
              icon={icon}
              aria-pressed={tool === id}
              style={tool === id ? { background: 'var(--ant-color-fill-secondary)' } : undefined}
              onClick={() => {
                model.getCurrentSQL()
                model.setHistoryOpen(false)
                historyLoad.current = undefined
                const next = tool === id ? 'editor' : id
                setTool(next)
                saveRedisTool(tab.id, next)
                if (id === 'pubsub') setPubSubOpened(true)
              }}
            />
          ))}
        </div>
        <Upload accept=".sql" showUploadList={false} beforeUpload={beforeImport} disabled={blocked || !editorMode || importing}>
          <ToolbarButton label={t('导入')} icon={<UploadOutlined />} loading={importing} disabled={blocked || !editorMode} />
        </Upload>
        <ToolbarButton label={t('导出')} icon={<DownloadOutlined />} disabled={blocked || !editorMode || !hasText} onClick={() => void model.exportCurrentSQL()} />
        <ToolbarButton label={t('执行历史')} icon={<HistoryOutlined />} disabled={blocked || (!editorMode && !consoleMode)} onClick={model.openHistory} />
      </QueryToolbar>
      {database === undefined ? (
        status !== 'error' && <ContentLoading label={t('正在加载数据库…')} style={{ flex: 1, minHeight: 0 }} />
      ) : (
        <>
          <Console
            page={tab.id}
            id={connection.id}
            connectionName={connection.name}
            host={connection.host}
            database={Number(database)}
            databases={snapshot?.databases ?? []}
            visible={active && consoleMode}
            themeMode={themeMode}
            blocked={model.running}
            loadedCommand={loadedCommand}
            onHistory={model.appendHistory}
            onBusy={setCommandBusy}
            onDatabase={(next) => model.selectRedisDatabase(tab.id, connection.id, String(next))}
          />
          {active && editorMode && (
            <>
              <Editor
                model={model}
                themeMode={themeMode}
                shortcutEnabled={!blocked && !model.historyOpen}
                onRun={model.runSQL}
                onViewChange={(view) => {
                  if (view) setHasText(Boolean(view.state.doc.toString().trim()))
                }}
                onContentChange={setHasText}
              />
              <QueryResults model={{ ...model, running: blocked }} themeMode={themeMode} />
            </>
          )}
          {active && tool === 'keys' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--workspace-inset)', userSelect: 'text' }}>
              <KeyBrowser key={database} id={connection.id} database={Number(database)} />
            </div>
          )}
          {pubSubOpened && (
            <div hidden={!active || tool !== 'pubsub'} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--workspace-inset)', userSelect: 'text' }}>
              <PubSub id={connection.id} active={active && tool === 'pubsub'} />
            </div>
          )}
        </>
      )}
      {active && (
        <QueryHistory
          model={{ ...model, running: blocked }}
          themeMode={themeMode}
          terminal={consoleMode}
          onLoad={
            consoleMode
              ? (item) => {
                  historyLoad.current = item
                  model.setHistoryOpen(false)
                }
              : undefined
          }
          onClosed={() => {
            if (consoleMode && historyLoad.current) setLoadedCommand({ ...historyLoad.current })
            historyLoad.current = undefined
          }}
        />
      )}
    </section>
  )
}
