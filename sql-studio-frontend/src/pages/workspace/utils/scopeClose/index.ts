import type { WorkspaceTab } from '@/typings/workspace'

export const pagesForScope = (pages: readonly WorkspaceTab[], id: string, database?: string) =>
  pages.filter((page) => page.connectionId === id && (database === undefined || page.database === database))

/** 多窗口合并为一个 SQL 文件，避免浏览器拦截多次下载；每份原稿保留独立说明。 */
export function sqlForPages(pages: readonly WorkspaceTab[]): string {
  const queries = pages.filter((page) => page.kind === 'query' && page.sql.trim())
  if (queries.length === 1) return queries[0].sql
  return queries.map((page) => `-- ${page.title.replace(/[\r\n]/g, ' ')} / ${page.database.replace(/[\r\n]/g, ' ')}\n${page.sql}`).join('\n\n')
}
