type Snapshot = {
  status: string
  tables: Record<string, unknown[]>
  loadingTables: string[]
  tableErrors: Record<string, string>
}

export type DatabaseOpenState = 'closed' | 'opening' | 'open' | 'error'

/** 连接与单个库分开判断，折叠状态不影响数据库是否已打开。 */
export function databaseOpenState(snapshot: Snapshot | undefined, closed: readonly string[] | undefined, database: string): DatabaseOpenState {
  if (snapshot?.status !== 'connected' || closed?.includes(database)) return 'closed'
  if (snapshot.loadingTables.includes(database)) return 'opening'
  if (snapshot.tableErrors[database]) return 'error'
  return snapshot.tables[database] !== undefined ? 'open' : 'closed'
}

/** 已查询到数据库名称不代表已打开该库；空库成功加载后同样允许转储。 */
export function canExportDatabase(snapshot: Snapshot | undefined, closed: readonly string[] | undefined, database: string): boolean {
  return databaseOpenState(snapshot, closed, database) === 'open'
}
