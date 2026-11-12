import type { WorkspaceTab } from '@/typings/workspace'

interface Options {
  validateSchemas: boolean
  snapshots: Readonly<Record<string, { schemas?: Record<string, string[]> }>>
}

/** 未加载的元数据不代表范围失效；无变化保持引用，重复校正不会再次更新状态。 */
export function reconcileWorkspacePages(pages: WorkspaceTab[], { validateSchemas, snapshots }: Options): WorkspaceTab[] {
  let changed = false
  const next = pages.map((page) => {
    const names = snapshots[page.connectionId]?.schemas?.[page.database]
    const scoped = validateSchemas && page.kind === 'query' && page.schema && names && !names.includes(page.schema) ? { ...page, schema: '', table: '' } : page
    changed ||= scoped !== page
    return scoped
  })
  return changed ? next : pages
}
