import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { Collapse, Empty, Pagination, Space, Typography } from 'antd'
import { useState } from 'react'

import ErrorNotice from '@/components/errorNotice'
import type { DatabaseType } from '@/databases/typings'
import { useTablePagination } from '@/hooks/useTablePagination'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'
import type { RunState } from '@/typings/workspace'

import { useQueryMessageScroll } from '../../hooks/useQueryMessageScroll'
import { statementDuration, statementOutputs } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'

type Props = { run: RunState; running: boolean; themeMode: ThemeMode; databaseType?: DatabaseType }
export default function QueryMessages({ run, running, themeMode, databaseType }: Props) {
  const tablePagination = useTablePagination()

  const { t } = useTranslation()

  const statements = statementOutputs(run)
  const identity = run.startedAt ?? run.id
  const [selection, setSelection] = useState<{ identity: typeof identity; page: number }>()
  const latestPage = Math.max(1, Math.ceil(statements.length / 50))
  const page = Math.min(latestPage, selection && selection.identity === identity ? selection.page : latestPage)
  const offset = (page - 1) * 50
  const visible = statements.slice(offset, offset + 50)
  const { content: contentRef, pause } = useQueryMessageScroll({
    identity,
    progress: statements.length,
    page,
    latest: page === latestPage,
    running,
    onFollowChange: (following) => setSelection(following ? undefined : { identity, page })
  })
  return (
    <div ref={contentRef} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {run.error && !statements.some((item) => item.error) && <ErrorNotice error={run.error} />}
      <Collapse
        destroyOnHidden
        key={`${identity}:${offset}:${visible.flatMap((item, index) => (item.error ? [index + offset] : [])).join(',')}`}
        defaultActiveKey={visible.flatMap((item, index) => (item.error ? [String(index + offset)] : []))}
        items={visible.map((item, position) => {
          const index = position + offset
          return {
            key: String(index),
            label: (
              <Space wrap>
                <Typography.Text>
                  {t('语句 ')}
                  {index + 1}
                </Typography.Text>
                <Typography.Text type={item.error ? 'danger' : 'success'}>
                  {item.error ? <CloseCircleOutlined /> : <CheckCircleOutlined />} {item.error ? t('执行失败') : t('执行成功')}
                </Typography.Text>
                <Typography.Text type="secondary">{statementDuration(item) === undefined ? t('耗时未记录') : `${statementDuration(item)} ms`}</Typography.Text>
              </Space>
            ),
            children: (
              <section aria-label={t('语句 {value1} 执行消息', { value1: index + 1 })}>
                {item.sql ? <SQLPreview compact sql={item.sql} themeMode={themeMode} databaseType={databaseType} /> : <div>{t('此结果未记录执行语句')}</div>}
                {item.error ? (
                  <ErrorNotice error={item.error} style={{ marginTop: 8 }} />
                ) : (
                  <Typography.Paragraph type="success" style={{ whiteSpace: 'pre-wrap', marginBlock: '8px 0' }}>
                    {item.result?.columns.length ? 'OK' : t('OK，影响 {value1} 行', { value1: item.result?.affectedRows ?? 0 })}
                  </Typography.Paragraph>
                )}
              </section>
            )
          }
        })}
      />
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
