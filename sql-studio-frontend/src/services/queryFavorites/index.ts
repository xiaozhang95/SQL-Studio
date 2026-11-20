import type { QueryFavorite } from '@/typings/workspace'

import { readState, writeState } from '../userState'

const section = 'query-favorites'

function isFavorite(value: unknown): value is QueryFavorite {
  if (!value || typeof value !== 'object') return false
  const favorite = value as Partial<QueryFavorite>
  return (
    typeof favorite.id === 'string' &&
    favorite.id.length > 0 &&
    typeof favorite.title === 'string' &&
    favorite.title.trim().length > 0 &&
    typeof favorite.sql === 'string' &&
    favorite.sql.trim().length > 0 &&
    typeof favorite.connectionId === 'string' &&
    typeof favorite.database === 'string' &&
    (favorite.schema === undefined || typeof favorite.schema === 'string')
  )
}

export async function listQueryFavorites(refresh = false): Promise<QueryFavorite[]> {
  const document = await readState<unknown>(section, async () => ({ items: [] }), refresh)
  if (!document || typeof document !== 'object' || !('items' in document) || !Array.isArray(document.items) || !document.items.every(isFavorite)) {
    throw new Error('查询收藏内容损坏，已保留原文件')
  }
  const items = document.items
  if (new Set(items.map(({ id }) => id)).size !== items.length) throw new Error('查询收藏内容损坏，已保留原文件')
  return items
}

/** Reapply the current item's change once against the latest revision on conflict. */
export async function changeQueryFavorites(change: (items: QueryFavorite[]) => QueryFavorite[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const items = change(await listQueryFavorites())
    if ((await writeState(section, { items })).saved) return items
  }
  throw new Error('查询收藏已在其他窗口更新，请重试')
}
