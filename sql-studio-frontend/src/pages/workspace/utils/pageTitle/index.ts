import type { WorkspaceTab } from '@/typings/workspace'

type Page = Pick<WorkspaceTab, 'kind' | 'title' | 'database' | 'schema'>

/** 只消费所属查询页的范围，不读取对象树选中项或旧结果来源。 */
export function queryPageContext(page: Page): string {
  return page.kind === 'query' && page.database ? `${page.database}${page.schema ? ' / ' + page.schema : ''}` : ''
}

/** 名称保留原值，显示前缀随范围派生，避免切库或恢复后重复拼接。 */
export function workspacePageTitle(page: Page): string {
  const context = queryPageContext(page)
  return context ? `${context} · ${page.title}` : page.title
}
