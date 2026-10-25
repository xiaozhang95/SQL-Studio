export const identifier = (name: string) => '`' + name.replaceAll('`', '``') + '`'

/** 只生成限定库表的只读预览语句，不自行发起请求。 */
export const tableDataSQL = (database: string, table: string) => `SELECT * FROM ${identifier(database)}.${identifier(table)} LIMIT 1000;`
