import type { Column, QueryResult } from '../../../typings/database/index.ts'
import { identifier } from '../query/index.ts'

/** Stand-in views let mutually ordered dump sections reference a view before its definition. */
export function viewStandIn(database: string, view: string, ddl: string, columns: Column[]) {
  // SHOW CREATE VIEW starts with CREATE [ALGORITHM ...] [DEFINER ...] VIEW.
  const definition = ddl.trimStart()
  if (!/^CREATE\s+(?:ALGORITHM\s*=|DEFINER\s*=|(?:SQL\s+SECURITY\s+(?:INVOKER|DEFINER)\s+)?VIEW\b)/i.test(definition) || !columns.length) {
    throw new Error('视图定义或字段不完整，请重新导出')
  }
  const fields = columns.map(({ name, charset, collation }) => {
    const valid = /^[a-z0-9_]+$/i
    if ((charset && !valid.test(charset)) || (collation && (!charset || !valid.test(collation)))) throw new Error('视图字段的字符集或排序规则无效')
    // Downstream definitions can require a particular character set via COLLATE.
    const value = charset ? "CONVERT('' USING " + charset + ')' + (collation ? ' COLLATE ' + collation : '') : '1'
    return value + ' AS ' + identifier(name)
  })
  return {
    placeholder: 'CREATE VIEW ' + identifier(database) + '.' + identifier(view) + ' AS SELECT ' + fields.join(', ') + ';\n',
    definition: definition.replace(/^CREATE\b/i, 'ALTER')
  }
}

function literal(value: unknown, type: string): string {
  if (value === null) return 'NULL'
  if (/GEOMETRY|POINT|POLYGON|LINESTRING|VECTOR/i.test(type)) throw new Error('空间和向量类型暂不支持数据转储')
  if (/^(?:BINARY|VARBINARY|(?:TINY|MEDIUM|LONG)?BLOB|BIT)$/i.test(type)) {
    if (typeof value !== 'string' || !/^0x[0-9a-f]*$/i.test(value)) throw new Error('二进制数据格式不完整')
    return value.length === 2 ? "X''" : value
  }
  if (/^(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|YEAR)$/i.test(type)) {
    const text = String(value)
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw new Error('数值数据格式不完整')
    return text
  }
  if (typeof value !== 'string' && typeof value !== 'boolean') throw new Error('不支持的数据格式')
  const hex = Array.from(new TextEncoder().encode(String(value)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return hex ? "CONVERT(X'" + hex + "' USING utf8mb4)" : "''"
}
export function dumpData(database: string, table: string, result: QueryResult, columns: Column[]): string {
  if (result.truncated) throw new Error('数据超过单次导出限制（5000 行或 8 MiB），未生成不完整的文件')
  const fields = result.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => !/(?:VIRTUAL|STORED) GENERATED/i.test(columns.find((field) => field.name === column.name)?.extra ?? ''))
  const target = identifier(database) + '.' + identifier(table)
  return (
    result.rows
      .map(
        (row) =>
          'INSERT INTO ' +
          target +
          ' (' +
          fields.map(({ column }) => identifier(column.name)).join(', ') +
          ') VALUES (' +
          fields.map(({ column, index }) => literal(row[index], column.type)).join(', ') +
          ');'
      )
      .join('\n') + '\n'
  )
}
