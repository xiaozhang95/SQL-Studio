import type { DBIndex } from '@/typings/database'

/** JSON 元组保留名称中的分隔符，避免同名库表及特殊字符发生碰撞。 */
export const objectNodeKey = (...parts: string[]) => JSON.stringify(parts)

export function indexDescription(index: DBIndex): string {
  const kind = index.name === 'PRIMARY' ? '主键' : index.unique ? '唯一索引' : '普通索引'
  const columns = [...index.columns]
    .sort((left, right) => left.position - right.position)
    .map((column) => `${column.name || '(表达式)'}${column.prefixLength === null ? '' : `(${column.prefixLength})`}${column.order === 'D' ? ' DESC' : ''}`)
  return `${kind} · ${index.type}\n${columns.join(', ')}`
}
