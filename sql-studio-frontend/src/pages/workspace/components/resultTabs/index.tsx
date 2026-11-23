import { LoadingOutlined, MessageOutlined, ProfileOutlined } from '@ant-design/icons'
import { Select, Tabs } from 'antd'
import type { ReactNode } from 'react'

import { appearance } from '@/constant/appearance'
import { useTranslation } from '@/hooks/useTranslation'
import type { RunState } from '@/typings/workspace'

import { resultTabLayout } from '../../constant/layout'
import { resultOutputs } from '../../utils/queryOutput'

type Props = {
  run: RunState
  running: boolean
  activeKey: string
  status?: ReactNode
  onChange: (key: string) => void
}
/** 消息、摘要与逐条结果共用一层受控导航。 */
export default function ResultTabs({ run, running, activeKey, status, onChange }: Props) {
  const { t } = useTranslation()

  const results = resultOutputs(run)
  const compact = results.length > resultTabLayout.maximumVisibleTabs
  const indexedResults = results.map((entry, resultIndex) => ({ ...entry, resultIndex }))
  const visibleResults = compact ? indexedResults.filter(({ index }) => String(index) === activeKey) : indexedResults
  return (
    <Tabs
      className="statement-result-tabs"
      aria-label={t('输出内容')}
      size={appearance.navigationSize}
      type="line"
      style={{ flex: 'none', minWidth: 0 }}
      styles={{
        header: { height: 38, margin: 0, paddingInline: 'var(--workspace-inset)', background: 'var(--surface)', borderBottom: '1px solid var(--border)' },
        item: { height: 30, padding: '0 8px', borderRadius: 'var(--ant-border-radius)' }
      }}
      tabBarGutter={4}
      activeKey={activeKey}
      onChange={onChange}
      tabBarExtraContent={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {status}
          {compact && (
            <Select
              aria-label={t('选择结果集')}
              size={appearance.navigationSize}
              style={{ width: appearance.selectWidth }}
              disabled={running}
              placeholder={t('选择结果集（共 {value1} 个）', { value1: results.length })}
              value={results.some(({ index }) => String(index) === activeKey) ? activeKey : undefined}
              options={indexedResults.map(({ index, resultIndex }) => ({ value: String(index), label: t('结果 {value1}（语句 {value2}）', { value1: resultIndex + 1, value2: index + 1 }) }))}
              onChange={onChange}
            />
          )}
        </div>
      }
      items={[
        { key: 'messages', label: t('消息'), icon: running ? <LoadingOutlined spin /> : <MessageOutlined /> },
        { key: 'summary', label: t('摘要'), icon: <ProfileOutlined /> },
        ...visibleResults.map(({ item, index, resultIndex }) => ({
          key: String(index),
          disabled: running,
          label: (
            <span title={t('语句 {value1}\n{value2}', { value1: index + 1, value2: item.sql || run.title || '' })}>
              {t('结果 ')}
              {resultIndex + 1}
            </span>
          )
        }))
      ]}
    />
  )
}
