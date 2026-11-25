import { CheckCircleOutlined, CloseCircleOutlined, StopOutlined } from '@ant-design/icons'
import { Collapse, Empty, Flex, Pagination, Space, Typography } from 'antd'
import { useState } from 'react'

import type { DatabaseType } from '@/databases/typings'
import { useTablePagination } from '@/hooks/useTablePagination'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'
import type { RunState } from '@/typings/workspace'

import { useQueryMessageScroll } from '../../hooks/useQueryMessageScroll'
import { batchRequestError, executionCancelled, statementDuration, statementErrorDetail, statementOutputs } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'

type Props = { run: RunState; running: boolean; themeMode: ThemeMode; databaseType?: DatabaseType }
export default function QueryMessages({ run, running, themeMode, databaseType }: Props) {
  const tablePagination = useTablePagination()

  const { t } = useTranslation()

  const statements = statementOutputs(run)
  const batchError = batchRequestError(run)
  const identity = run.startedAt ?? run.id
  const [selection, setSelection] = useState<{ identity: typeof identity; page: number }>()
  const latestPage = Math.max(1, Math.ceil(statements.length / 50))
  const page = Math.min(latestPage, selection && selection.identity === identity ? selection.page : latestPage)
  const offset = (page - 1) * 50
  const visible = statements.slice(offset, offset + 50)
  const { content: contentRef, pause } = useQueryMessageScroll({
    identity,
    progress: statements.length + Number(Boolean(batchError)),
    page,
    latest: page === latestPage,
    running,
    onFollowChange: (following) => setSelection(following ? undefined : { identity, page })
  })
  return (
    <div ref={contentRef} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {executionCancelled(run) && !statements.some(executionCancelled) && <Typography.Text type="secondary">{t('执行已取消')}</Typography.Text>}
      <Collapse
        destroyOnHidden
        key={`${identity}:${offset}`}
        items={visible.map((item, position) => {
          const index = position + offset
          const cancelled = executionCancelled(item)
          const detail = run.kind === 'query' ? statementErrorDetail(item) : undefined
          const requestError = !cancelled && !detail ? item.error : undefined
          return {
            key: String(index),
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
                {!item.error && !cancelled && (
                  <Typography.Paragraph type="success" style={{ whiteSpace: 'pre-wrap', marginBlock: '8px 0' }}>
                    {item.result?.columns.length || item.result?.writeFeedbackUnavailable ? 'OK' : t('OK，影响 {value1} 行', { value1: item.result?.affectedRows ?? 0 })}
                  </Typography.Paragraph>
                )}
              </section>
            )
          }
        })}
      />
      {batchError && page === latestPage && (
        <Collapse
          destroyOnHidden
          key={identity}
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
      {statements.length > 50 && (
        <Pagination
          {...tablePagination}
          current={page}
          pageSize={50}
          total={statements.length}
          onChange={(page) => {
            pause()
            setSelection({ identity, page })
          }}
        />
      )}
      {running && <Typography.Text type="secondary">{t('正在执行，消息随已完成语句更新…')}</Typography.Text>}
      {!running && !statements.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('暂无执行消息')} />}
    </div>
  )
}
