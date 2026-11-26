import { CheckCircleOutlined, CloseCircleOutlined, StopOutlined } from '@ant-design/icons'
import { Collapse, Empty, Flex, Space, Typography } from 'antd'
import { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import type { Components } from 'react-virtuoso'

import type { DatabaseType } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'
import type { RunState, StatementRun } from '@/typings/workspace'

import { useQueryMessageScroll } from '../../hooks/useQueryMessageScroll'
import { batchRequestError, executionCancelled, statementDuration, statementErrorDetail, statementOutputs } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'

type Props = { run: RunState; running: boolean; themeMode: ThemeMode; databaseType?: DatabaseType }
type MessageContext = { cancelled: boolean; batchError?: string; running: boolean; empty: boolean }

const listComponents: Components<StatementRun, MessageContext> = {
  Header: function MessageHeader({ context }) {
    const { t } = useTranslation()
    return context.cancelled ? (
      <div style={{ padding: 12 }}>
        <Typography.Text type="secondary">{t('执行已取消')}</Typography.Text>
      </div>
    ) : null
  },
  Footer: function MessageFooter({ context }) {
    const { t } = useTranslation()
    const { batchError, running, empty } = context
    if (!batchError && !running && !empty) return null

    return (
      <Flex vertical gap={12} style={{ padding: 12 }}>
        {batchError && (
          <Collapse
            destroyOnHidden
            items={[
              {
                key: 'request-error',
                label: (
                  <Typography.Text type="danger">
                    <CloseCircleOutlined /> {t('请求失败')}
                  </Typography.Text>
                ),
                children: (
                  <Typography.Text type="danger" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {t(batchError)}
                  </Typography.Text>
                )
              }
            ]}
          />
        )}
        {running && <Typography.Text type="secondary">{t('正在执行，消息随已完成语句更新…')}</Typography.Text>}
        {!running && empty && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('暂无执行消息')} />}
      </Flex>
    )
  }
}

export default function QueryMessages({ run, running, themeMode, databaseType }: Props) {
  const { t } = useTranslation()
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())

  const statements = statementOutputs(run)
  const batchError = batchRequestError(run)
  const content = useQueryMessageScroll({ progress: statements.length + Number(Boolean(batchError)), running })

  function renderMessage(index: number, item: StatementRun) {
    const { result } = item
    const cancelled = executionCancelled(item)
    const detail = run.kind === 'query' ? statementErrorDetail(item) : undefined
    const requestError = !cancelled && !detail ? item.error : undefined
    const affectedRows = !item.error && !cancelled && result && !result.columns.length && !result.writeFeedbackUnavailable ? result.affectedRows : undefined
    const key = String(index)
    return (
      <div style={{ paddingBlock: 2, paddingInline: 12 }}>
        <Collapse
          destroyOnHidden
          activeKey={expanded.has(index) ? [key] : []}
          onChange={(keys) => {
            setExpanded((previous) => {
              const next = new Set(previous)
              if (keys.length) next.add(index)
              else next.delete(index)
              return next
            })
          }}
          items={[
            {
              key,
              label: (
                <Flex vertical gap={4} style={{ minWidth: 0 }}>
                  <Space wrap>
                    <Typography.Text>
                      {t('语句 ')}
                      {index + 1}
                    </Typography.Text>
                    <Typography.Text type={cancelled ? 'secondary' : item.error ? 'danger' : 'success'}>
                      {cancelled ? <StopOutlined /> : item.error ? <CloseCircleOutlined /> : <CheckCircleOutlined />} {t(cancelled ? '执行已取消' : item.error ? '执行失败' : '执行成功')}
                    </Typography.Text>
                    <Typography.Text type="secondary">{statementDuration(item) === undefined ? t('耗时未记录') : `${statementDuration(item)} ms`}</Typography.Text>
                  </Space>
                  {detail && (
                    <Typography.Text type="danger" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {t(detail)}
                    </Typography.Text>
                  )}
                </Flex>
              ),
              children: (
                <section aria-label={t('语句 {value1} 执行消息', { value1: index + 1 })}>
                  {item.sql ? <SQLPreview compact sql={item.sql} themeMode={themeMode} databaseType={databaseType} /> : <div>{t('此结果未记录执行语句')}</div>}
                  {requestError && (
                    <Typography.Paragraph type="danger" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBlock: '8px 0' }}>
                      {t(requestError)}
                    </Typography.Paragraph>
                  )}
                  {typeof affectedRows === 'number' && (
                    <Typography.Paragraph type="success" style={{ whiteSpace: 'pre-wrap', marginBlock: '8px 0' }}>
                      {t('影响 {value1} 行', { value1: affectedRows })}
                    </Typography.Paragraph>
                  )}
                </section>
              )
            }
          ]}
        />
      </div>
    )
  }

  return (
    <div ref={setViewport} role="region" tabIndex={0} aria-label={t('消息')} style={{ height: '100%', overflow: 'auto' }}>
      <div ref={content} style={{ paddingBlock: 10 }}>
        {viewport && (
          <Virtuoso
            customScrollParent={viewport}
            data={statements}
            components={listComponents}
            context={{ cancelled: executionCancelled(run) && !statements.some(executionCancelled), batchError, running, empty: !statements.length }}
            itemContent={renderMessage}
          />
        )}
      </div>
    </div>
  )
}
