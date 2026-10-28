import type { QueryResult } from '../../../typings/database/index.ts'
import type { DatabaseDefinition, ObjectFormValues } from '../../typings/objectManagement/index.ts'
import { identifier, literal } from '../query/index.ts'

export const metadataSQL = (database: string) =>
  `SELECT datname AS name, pg_catalog.pg_get_userbyid(datdba) AS owner, pg_catalog.pg_encoding_to_char(encoding) AS encoding, datcollate AS collation, datctype AS ctype, datconnlimit AS connection_limit, COALESCE(pg_catalog.shobj_description(oid,'pg_database'),'') AS comment FROM pg_catalog.pg_database WHERE datname=${literal(database)};`

export function definition(result: QueryResult): DatabaseDefinition {
  if (result.truncated || result.rows.length !== 1) throw new Error('数据库不存在、无权访问或属性结果不完整')
  const row = result.rows[0]
  const cell = (name: string) => row[result.columns.findIndex((column) => column.name === name)]
  const text = (name: string) => {
    const value = cell(name)
    if (typeof value !== 'string') throw new Error('数据库属性格式无效：' + name)
    return value
  }
  const limit = cell('connection_limit')
  if ((typeof limit !== 'string' && typeof limit !== 'number') || !/^-?\d+$/.test(String(limit)) || !Number.isInteger(Number(limit)) || Number(limit) < -1 || Number(limit) > 2147483647)
    throw new Error('数据库连接数上限无效')
  return { name: text('name'), owner: text('owner'), charset: text('encoding'), collation: text('collation'), ctype: text('ctype'), connectionLimit: Number(limit), comment: text('comment') }
}

export function sql(database: string, values: ObjectFormValues, original: DatabaseDefinition): string {
  if (original.name !== database || !original.owner || original.connectionLimit === undefined || original.comment === undefined) throw new Error('请重新加载数据库属性')
  if (!values.owner?.trim() || values.owner.includes('\0') || new TextEncoder().encode(values.owner).length > 63) throw new Error('所有者名称无效，最多 63 个 UTF-8 字节')
  if (!Number.isInteger(values.connectionLimit) || values.connectionLimit! < -1 || values.connectionLimit! > 2147483647) throw new Error('连接数上限必须是 -1 至 2147483647 的整数')
  if (typeof values.comment !== 'string' || values.comment.includes('\0')) throw new Error('数据库注释无效')
  const target = identifier(database),
    statements: string[] = []
  if (values.connectionLimit !== original.connectionLimit) statements.push(`ALTER DATABASE ${target} CONNECTION LIMIT ${values.connectionLimit}`)
  if (values.comment !== original.comment) statements.push(`COMMENT ON DATABASE ${target} IS ${values.comment ? literal(values.comment) : 'NULL'}`)
  // 最后转移所有者，避免前两项因本次权限变化而失败；全部在同一个 DO 事务中提交。
  if (values.owner !== original.owner) statements.push(`ALTER DATABASE ${target} OWNER TO ${identifier(values.owner)}`)
  if (!statements.length) throw new Error('数据库属性没有变化')
  const guard = `IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datname=${literal(database)} AND pg_catalog.pg_get_userbyid(datdba)=${literal(original.owner)} AND datconnlimit=${original.connectionLimit} AND COALESCE(pg_catalog.shobj_description(oid,'pg_database'),'')=${literal(original.comment)}) THEN RAISE EXCEPTION '数据库属性已变化，请重新加载后再编辑'; END IF;`
  const body = `${guard}\n${statements.map((statement) => `EXECUTE ${literal(statement)};`).join('\n')}`
  let tag = '$sql_studio_database$'
  while (body.includes(tag)) tag = tag.slice(0, -1) + '_$'
  return `DO ${tag}\nBEGIN\n${body}\nEND;\n${tag};`
}
