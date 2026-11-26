import { LoadingOutlined, MessageOutlined, ProfileOutlined } from '@ant-design/icons'
import { Flex, Select, Tabs } from 'antd'
import type { ReactNode } from 'react'

import { useTranslation } from '@/hooks/useTranslation'
import type { RunState } from '@/typings/workspace'

import { resultControlProps, resultTabLayout, resultToolbarIconInset, resultToolbarSpacing, workspaceInset, workspaceTabBarStyle } from '../../constant/layout'
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
  const visibleResults = compact ? indexedResults.filter(({ key }) => key === activeKey) : indexedResults
  return (
    <Flex className="result-navigation" wrap align="center" style={{ minWidth: 0, paddingInline: workspaceInset, borderBlockEnd: 'var(--ant-line-width) solid var(--layout-divider)' }}>
      <Tabs
        className="statement-result-tabs"
        aria-label={t('输出内容')}
        type="line"
        style={{ flex: `1 1 ${resultTabLayout.wrapBasis}px`, minWidth: 0, maxWidth: '100%' }}
        styles={{
          header: workspaceTabBarStyle,
          item: { height: 'var(--ant-control-height)', paddingBlock: 0, paddingInline: resultToolbarIconInset, borderRadius: 'var(--ant-border-radius)' }
        }}
        tabBarGutter={4}
        activeKey={activeKey}
        onChange={onChange}
        items={[
          { key: 'messages', label: t('消息'), icon: running ? <LoadingOutlined spin /> : <MessageOutlined /> },
          { key: 'summary', label: t('摘要'), icon: <ProfileOutlined /> },
          ...visibleResults.map(({ item, index, key, resultIndex }) => ({
            key,
            disabled: running,
            label: (
              <span title={t('语句 {value1}\n{value2}', { value1: index + 1, value2: item.sql || t(run.title ?? '') })}>
                {t('结果 ')}
                {resultIndex + 1}
              </span>
            )
          }))
        ]}
      />
      {(compact || status) && (
        <Flex
          className="result-navigation-actions"
          align="center"
          justify="end"
          wrap
          style={{ ...resultToolbarSpacing, minWidth: 0, maxWidth: '100%' }}
        >
          {compact && (
            <Select
              {...resultControlProps}
              className="result-picker"
              aria-label={t('选择结果集')}
              disabled={running}
              placeholder={t('选择结果集（共 {value1} 个）', { value1: results.length })}
              value={results.some(({ key }) => key === activeKey) ? activeKey : undefined}
              options={indexedResults.map(({ index, key, resultIndex }) => ({ value: key, label: t('结果 {value1}（语句 {value2}）', { value1: resultIndex + 1, value2: index + 1 }) }))}
              onChange={onChange}
            />
          )}
          {status}
        </Flex>
      )}
    </Flex>
  )
}
