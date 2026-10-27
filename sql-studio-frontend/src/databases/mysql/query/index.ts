import type { DBTable, QueryResult } from '../../../typings/database/index.ts'

export const identifier = (name: string) => '`' + name.replaceAll('`', '``') + '`'

/** 只生成限定库表的只读预览语句，不自行发起请求。 */
export const tableDataSQL = (database: string, table: string) => `SELECT * FROM ${identifier(database)}.${identifier(table)} LIMIT 1000;`

export const tableLabel = (table: string) => table
export const tableListResult = (tables: readonly DBTable[]): Pick<QueryResult, 'columns' | 'rows'> => ({
  columns: ['表名', '类型', '注释'].map((name) => ({ name, type: '' })),
  rows: tables.map((table) => [table.name, table.type, table.comment])
})
