import { DatabaseOutlined } from '@ant-design/icons'
import { Alert, Card, Collapse, Descriptions, Flex, Space, Table, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import type { ReactNode } from 'react'

import { appearance } from '@/constant/appearance'
import { tablePaginationDefaults } from '@/constant/tablePagination'

import { APPEARANCE } from '../../../../constant/appearance'
import { isObject } from '../../../../utils/json'
import { cellText, readResult } from '../../../../utils/queryResult'
import { CHAT } from '../../constant/chat'
import { ExportExcel } from '../exportExcel'

interface Row {
  key: number
  [column: string]: unknown
}
interface Props {
  value: unknown
  sql?: string
  title?: string
  tool?: string
  showExport?: boolean
  showHeader?: boolean
}
export function QueryResult({ showExport = true, ...props }: Props) {
  if (isObject(props.value) && typeof props.value.error === 'string') return null
  if (isObject(props.value) && typeof props.value.warning === 'string') {
    // Tool failures carry a recovery instruction for DeepSeek. Other warnings can describe a successful operation.
    if (typeof props.value.instruction === 'string') return null
    return <Alert type="warning" showIcon title={props.value.warning} />
  }
  return (
    <Flex vertical gap={CHAT.spacing.block} style={{ width: '100%', minWidth: 0 }}>
      <ResultContent {...props} />
      {showExport && <ExportExcel value={props.value} title={props.title ?? '查询结果'} />}
    </Flex>
  )
}

/** 外层只组织可选标题与内容，表格边框由 Table 的 section 绘制。 */
function ResultTable({ title, extra, children }: { title?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <Flex vertical gap={CHAT.spacing.detail} style={{ minWidth: 0 }}>
      {(title || extra) && (
        <Flex align="center" justify="space-between" gap={CHAT.spacing.detail} wrap>
          {title}
          {extra}
        </Flex>
      )}
      {children}
    </Flex>
  )
}

const resultTableClassNames = { section: 'agent-result-grid', pagination: { root: 'agent-result-pagination' } } as const

function ResultContent({ value, sql, title = '查询结果', tool, showHeader = true }: Props) {
  const cardTitle = showHeader ? (
    <Space size="small">
      <DatabaseOutlined className="chat-result-icon" />
      <Typography.Text>{title}</Typography.Text>
    </Space>
  ) : undefined
  const result = readResult(value)
  if (isObject(value) && value.isQuery === false)
    return (
      <Card size="small" className="content-frame" title={cardTitle}>
        <Descriptions
          size="small"
          column={1}
          items={[
            { key: 'affected', label: '影响行数', children: String(value.affectedRows ?? 0) },
            { key: 'id', label: '新增ID', children: String(value.lastInsertId || '—') }
          ]}
        />
      </Card>
    )
  if (result) {
    const columnWidths = result.columns.map((column) => Math.min(280, Math.max(140, column.name.length * 14 + 32)))
    const scrollWidth = columnWidths.reduce((width, columnWidth) => width + columnWidth, CHAT.resultIndexWidth)
    const columns: TableColumnsType<Row> = [
      {
        title: '#',
        dataIndex: 'key',
        key: 'row-number',
        width: CHAT.resultIndexWidth,
        fixed: 'left',
        align: 'right',
        render: (v: number) => <Typography.Text type="secondary">{v + 1}</Typography.Text>
      },
      ...result.columns.map((c, i) => ({
        title: <Tooltip title={c.type}>{c.name || `列 ${i + 1}`}</Tooltip>,
        dataIndex: String(i),
        key: String(i),
        // Let the last data column absorb extra space so the row number keeps its width.
        width: i === columnWidths.length - 1 ? undefined : columnWidths[i],
        ellipsis: true,
        render: (v: unknown) => {
          const text = cellText(v)
          return (
            <Tooltip title={text}>
              <Typography.Text type={v === null || v === '' ? 'secondary' : undefined}>{text}</Typography.Text>
            </Tooltip>
          )
        }
      }))
    ]
    const rows: Row[] = result.rows.map((row, i) => ({
      key: i,
      ...Object.fromEntries(row.map((v, j) => [String(j), v]))
    }))
    return (
      <ResultTable
        title={cardTitle}
        extra={
          showHeader && (
            <Space size="middle">
              <Typography.Text type="secondary">
                {rows.length} 行 · {result.columns.length} 列
              </Typography.Text>
              <Typography.Text type="secondary">{result.durationMs} ms</Typography.Text>
            </Space>
          )
        }
      >
        {result.truncated && <Alert type="warning" showIcon title="结果已截断，统计全量请使用聚合查询。" banner />}
        <Table<Row>
          classNames={resultTableClassNames}
          aria-label="查询结果"
          size={appearance.tableSize}
          bordered
          tableLayout="fixed"
          columns={columns}
          dataSource={rows}
          pagination={{
            ...tablePaginationDefaults,
            defaultPageSize: APPEARANCE.resultPageSize,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: rows.length > 10,
            hideOnSinglePage: rows.length <= 10,
            showTotal: (total) => `共 ${total} 行`
          }}
          scroll={{
            x: scrollWidth,
            y: rows.length > 10 ? APPEARANCE.resultPreviewHeight : undefined
          }}
          locale={{ emptyText: '查询成功，没有匹配的数据' }}
        />
        {sql && (
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: 'sql',
                label: '查看 SQL',
                children: (
                  <Typography.Paragraph
                    copyable={{ text: sql }}
                    style={{
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      margin: 0
                    }}
                  >
                    {sql}
                  </Typography.Paragraph>
                )
              }
            ]}
          />
        )}
      </ResultTable>
    )
  }
  if (tool === 'use_database' && isObject(value) && isObject(value.target)) {
    return (
      <Card size="small" className="content-frame" title={cardTitle}>
        <Descriptions
          size="small"
          column={1}
          items={[
            {
              key: 'database',
              label: '数据库',
              children: cellText(value.target.database)
            },
            { key: 'engine', label: '引擎', children: cellText(value.engine) }
          ]}
        />
      </Card>
    )
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'string'))
    return (
      <ResultTable title={cardTitle} extra={showHeader ? `${value.length} 项` : undefined}>
        <Table
          classNames={resultTableClassNames}
          size={appearance.tableSize}
          bordered
          columns={[{ title: '名称', dataIndex: 'name', key: 'name' }]}
          dataSource={value.map((name, i) => ({ key: i, name }))}
          pagination={{
            ...tablePaginationDefaults,
            pageSize: APPEARANCE.resultPageSize,
            hideOnSinglePage: true
          }}
          scroll={{
            y: value.length > 10 ? APPEARANCE.resultPreviewHeight : undefined
          }}
        />
      </ResultTable>
    )
  if (Array.isArray(value) && value.length > 0 && value.every(isObject)) {
    const keys = [...new Set(value.flatMap((v) => Object.keys(v)))].filter((k) => tool !== 'list_connections' || k !== 'id')
    const labels: Record<string, string> = {
      name: tool === 'list_connections' ? '连接名称' : '名称',
      type: '类型',
      comment: '备注',
      nullable: '允许为空',
      key: '键',
      default: '默认值',
      extra: '附加信息',
      id: '标识'
    }
    const columns = keys.map((key, index) => ({
      title: labels[key] ?? key,
      key,
      dataIndex: String(index),
      ellipsis: true,
      width: key === 'comment' ? 280 : 180,
      render: (v: unknown) => <Tooltip title={cellText(v)}>{cellText(v)}</Tooltip>
    }))
    return (
      <ResultTable title={cardTitle} extra={showHeader ? `${value.length} 项` : undefined}>
        <Table
          classNames={resultTableClassNames}
          size={appearance.tableSize}
          bordered
          tableLayout="fixed"
          columns={columns}
          dataSource={value.map((v, i) => ({
            key: i,
            ...Object.fromEntries(keys.map((k, j) => [String(j), v[k]]))
          }))}
          pagination={{
            ...tablePaginationDefaults,
            pageSize: APPEARANCE.resultPageSize,
            hideOnSinglePage: true
          }}
          scroll={{
            x: columns.reduce((width, column) => width + column.width, 0),
            y: value.length > 10 ? APPEARANCE.resultPreviewHeight : undefined
          }}
        />
      </ResultTable>
    )
  }
  return (
    <Card size="small" className="content-frame" title={cardTitle}>
      <Typography.Paragraph
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          maxHeight: APPEARANCE.resultPreviewHeight,
          overflow: 'auto',
          margin: 0
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Typography.Paragraph>
    </Card>
  )
}
