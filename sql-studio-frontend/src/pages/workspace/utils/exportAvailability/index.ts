type Snapshot = {
  status: string
  tables: Record<string, unknown[]>
  loadingTables: string[]
  tableErrors: Record<string, string>
}

/** 已查询到数据库名称不代表已打开该库；空库成功加载后同样允许转储。 */
export function canExportDatabase(snapshot: Snapshot | undefined, closed: readonly string[] | undefined, database: string): boolean {
  return Boolean(
    snapshot?.status === 'connected' && snapshot.tables[database] !== undefined && !snapshot.loadingTables.includes(database) && !snapshot.tableErrors[database] && !closed?.includes(database)
  )
}
