import { ClockCircleOutlined, DatabaseOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons'
import { App as AntApp, Button, Collapse, Drawer, Empty, Input, Tag, Tooltip } from 'antd'

import type { WorkspaceModel } from '../../hooks/useWorkspace'

type Props = { model: Pick<WorkspaceModel, 'history' | 'setHistory' | 'historyOpen' | 'setHistoryOpen' | 'historySearch' | 'setHistorySearch' | 'running' | 'connections' | 'addTab'> }

/** 历史默认收起，只展开一条详情；载入操作不会直接执行 SQL。 */
export default function QueryHistory({ model }: Props) {
  const { history, setHistory, historyOpen, setHistoryOpen, historySearch, setHistorySearch, running, connections, addTab } = model
  const { modal } = AntApp.useApp()
  return (
    <Drawer
      title={
        <span>
          <HistoryOutlined /> 执行历史
        </span>
      }
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      size={560}
      extra={
        <Button
          type="text"
          danger
          disabled={!history.length}
          onClick={() =>
            modal.confirm({
              title: '清空本机执行历史？',
              onOk: () => setHistory([])
            })
          }
        >
          清空
        </Button>
      }
    >
      <Input prefix={<SearchOutlined />} placeholder="搜索 SQL / 数据库" aria-label="搜索执行历史" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} allowClear />
      {!history.length ? (
        <Empty image={<HistoryOutlined className="empty-state-icon" />} description="暂无执行历史" />
      ) : (
        <Collapse
          className="history-list"
          accordion
          destroyOnHidden
          items={history
            .filter((item) => `${item.sql} ${item.database}`.toLowerCase().includes(historySearch.toLowerCase()))
            .map((item) => ({
              key: item.id,
              label: (
                <div>
                  <div className="history-heading">
                    <Tag color={item.ok ? 'success' : 'error'}>{item.ok ? '成功' : '失败'}</Tag>
                    <span>{new Date(item.time).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="history-summary" title={item.sql}>
                    {item.sql.replace(/\s+/g, ' ')}
                  </div>
                </div>
              ),
              children: (
                <>
                  <pre className="history-sql">{item.sql}</pre>
                  <div className="history-bottom">
                    <Tooltip title={item.connectionName}>
                      <Tag color="blue" icon={<DatabaseOutlined />}>
                        {item.database || item.connectionName}
                      </Tag>
                    </Tooltip>
                    <span>
                      <ClockCircleOutlined /> {item.durationMs} ms
                    </span>
                    <Button
                      type="link"
                      disabled={running || !connections.some((c) => c.id === item.connectionId)}
                      onClick={() => {
                        addTab(item.sql, { connectionId: item.connectionId, database: item.database, schema: item.schema || '', table: '' })
                        setHistoryOpen(false)
                      }}
                    >
                      载入编辑器
                    </Button>
                  </div>
                  {item.error && <div className="history-error">{item.error}</div>}
                </>
              )
            }))}
        />
      )}
    </Drawer>
  )
}
