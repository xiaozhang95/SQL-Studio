import { Alert, Button, Descriptions, Modal, Progress } from 'antd'
import { useEffect, useRef, useState } from 'react'

import ErrorNotice from '@/components/errorNotice'

import type { useDataExport } from '../../hooks/useDataExport'

/** Navicat-style summary, bounded log and table progress with native theme tokens. */
export default function DataExport({ model }: { model: ReturnType<typeof useDataExport> }) {
  const { state, busy } = model
  const [now, setNow] = useState(() => Date.now())
  const logs = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [busy])
  useEffect(() => {
    if (logs.current) logs.current.scrollTop = logs.current.scrollHeight
  }, [state?.logs])
  return (
    <Modal
      title="转储 SQL 文件"
      open={Boolean(state)}
      width={760}
      styles={{ body: { maxHeight: 'calc(100dvh - 240px)', overflowY: 'auto', overflowX: 'hidden' } }}
      closable={!busy}
      mask={{ closable: !busy }}
      keyboard={!busy}
      onCancel={model.close}
      footer={
        busy ? (
          <Button danger onClick={model.cancel}>
            取消导出
          </Button>
        ) : (
          <Button type="default" onClick={model.close}>
            关闭
          </Button>
        )
      }
    >
      {state && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Descriptions
            column={{ xs: 1, sm: 2 }}
            size="small"
            styles={{ label: { whiteSpace: 'nowrap' }, content: { minWidth: 0, overflowWrap: 'anywhere' } }}
            items={[
              { key: 'server', label: '连接', children: state.connection },
              { key: 'database', label: '数据库', children: <span style={{ overflowWrap: 'anywhere' }}>{state.database}</span> },
              { key: 'file', label: '转储到', children: <span style={{ overflowWrap: 'anywhere' }}>{state.destination}</span> },
              { key: 'mode', label: '内容', children: state.withData ? '结构和数据' : '仅结构' },
              { key: 'tables', label: '已处理对象', children: `${state.completed} / ${state.total}` },
              { key: 'rows', label: '已传输记录', children: state.rows.toLocaleString() },
              { key: 'bytes', label: '已写入', children: `${(state.bytes / 1024 / 1024).toFixed(2)} MiB` },
              { key: 'errors', label: '错误', children: state.error ? 1 : 0 },
              { key: 'time', label: '时间', children: `${(Math.max(0, (state.endedAt ?? now) - state.startedAt) / 1000).toFixed(1)}s` }
            ]}
          />
          <Alert type="info" title="导出可访问的表和视图结构；不包含例程、触发器、事件及权限。跨表不保证同一时间快照，导出期间请避免修改结构及数据。" />
          <ErrorNotice title="导出失败，未保存完整文件" error={state.error} />
          <div
            ref={logs}
            role="log"
            aria-label="导出日志"
            style={{ height: 200, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', border: '1px solid var(--ant-color-border)', padding: 12 }}
          >
            {state.logs.join('\n')}
          </div>
          {state.status !== 'cancelled' && <Progress percent={state.percent} status={state.status === 'error' ? 'exception' : state.status === 'completed' ? 'success' : 'active'} />}
          {busy && <span>进度按已处理对象计算；记录数随传输实时更新。</span>}
        </div>
      )}
    </Modal>
  )
}
