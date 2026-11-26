/** 普通关键词匹配名称任意位置，显式 Redis glob 保持原样。 */
export function redisSearchPattern(filter: string) {
  return filter && !/[*?[\\]/.test(filter) ? `*${filter}*` : filter
}
