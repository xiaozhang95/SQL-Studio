/** MySQL 元数据和语句记录中明确承载 SQL 的列名；不根据普通文本内容猜测。 */
const sqlColumnNames = new Set([
  'ddl',
  'sql',
  'sql text',
  'query',
  'statement',
  'sql original statement',
  'create database',
  'create table',
  'create view',
  'create procedure',
  'create function',
  'create trigger',
  'create event',
  'view definition',
  'routine definition',
  'action statement',
  'event definition'
])

export function isSQLColumn(name: string): boolean {
  return sqlColumnNames.has(
    name
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, ' ')
  )
}
