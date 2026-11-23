const openQueryEvent = 'sql-studio:open-query'

/** 跨页面请求把一段 SQL 打开到工作区查询页。 */
export function requestOpenQuery(sql: string) {
  if (!sql.trim()) return
  window.dispatchEvent(new CustomEvent<{ sql: string }>(openQueryEvent, { detail: { sql } }))
}

/** 工作区外壳订阅打开查询请求；返回取消订阅函数。 */
export function subscribeOpenQuery(handler: (sql: string) => void) {
  const listener = (event: Event) => {
    const sql = (event as CustomEvent<{ sql?: string }>).detail?.sql
    if (typeof sql === 'string' && sql.trim()) handler(sql)
  }
  window.addEventListener(openQueryEvent, listener)
  return () => window.removeEventListener(openQueryEvent, listener)
}
