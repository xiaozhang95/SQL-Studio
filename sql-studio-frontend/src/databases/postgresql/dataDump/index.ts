import type { Column, QueryResult } from '../../../typings/database/index.ts'
import { identifier, literal, relation, tableIdentity } from '../query/index.ts'

export const querySQL = (_database: string, table: string) => `SELECT * FROM ${relation(table)};`
/** 仅枚举目标表自有 SERIAL/IDENTITY 序列，所有值保持文本精度；不读取业务表。 */
export function metadataSQL(_database: string, table: string): string {
  const [schema, name] = tableIdentity(table)
  return `SELECT a.attname AS column_name, sn.nspname AS sequence_schema, s.relname AS sequence_name, a.attidentity::text AS identity_kind, pg_catalog.format_type(q.seqtypid,NULL) AS data_type, q.seqstart::text AS start_value, q.seqmin::text AS min_value, q.seqmax::text AS max_value, q.seqincrement::text AS increment_by, q.seqcache::text AS cache_size, q.seqcycle AS cycle, ps.last_value::text AS last_value, pg_catalog.has_sequence_privilege(s.oid,'SELECT,USAGE') AS readable FROM pg_catalog.pg_class t JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped JOIN pg_catalog.pg_depend d ON d.refclassid='pg_catalog.pg_class'::regclass AND d.refobjid=t.oid AND d.refobjsubid=a.attnum AND d.classid='pg_catalog.pg_class'::regclass AND d.deptype IN ('a','i') JOIN pg_catalog.pg_class s ON s.oid=d.objid AND s.relkind='S' JOIN pg_catalog.pg_namespace sn ON sn.oid=s.relnamespace JOIN pg_catalog.pg_sequence q ON q.seqrelid=s.oid LEFT JOIN pg_catalog.pg_sequences ps ON ps.schemaname=sn.nspname AND ps.sequencename=s.relname WHERE n.nspname=${literal(schema)} AND t.relname=${literal(name)} ORDER BY a.attnum;`
}

function valueSQL(value: unknown, type: string): string {
  if (value === null) return 'NULL'
  if (/^BYTEA$/i.test(type)) {
    if (typeof value !== 'string' || !/^\\x(?:[a-f0-9]{2})*$/i.test(value)) throw new Error('BYTEA 数据格式不完整')
    return `pg_catalog.decode('${value.slice(2)}','hex')`
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number' && /^(?:INT[248]|NUMERIC|DECIMAL|BIGINT|SMALLINT|INTEGER)$/i.test(type) && !Number.isSafeInteger(value)) throw new Error('精确数值缺少原始文本，无法安全转储')
  return literal(value)
}

export function dump(database: string, table: string, ddl: string, result: QueryResult, columns: Column[], metadata?: QueryResult): string {
  if (result.truncated || metadata?.truncated) throw new Error('数据超过单次导出限制（5000 行或 8 MiB），未生成不完整的文件')
  if (!metadata || !ddl.trim() || !Array.isArray(result.rows) || result.rows.length !== result.rowCount) throw new Error('转储数据或元数据不完整')
  if (/\)\s+PARTITION BY\b/i.test(ddl) || /^CREATE\s+(?:MATERIALIZED\s+)?VIEW\b/i.test(ddl.trim())) throw new Error('分区表和视图的数据请使用 pg_dump 导出')
  const target = relation(table),
    [schema] = tableIdentity(table)
  const schemas = new Set([schema]),
    sequenceColumns = new Set<string>(),
    sequenceNames = new Set<string>()
  const before: string[] = [],
    after: string[] = [],
    resets: string[] = []
  for (const row of metadata.rows) {
    const cell = (key: string) => row[metadata.columns.findIndex((field) => field.name === key)]
    const text = (key: string) => {
      const value = cell(key)
      if (typeof value !== 'string' || value.includes('\0')) throw new Error('序列元数据格式不完整：' + key)
      return value
    }
    const integer = (key: string) => {
      const value = text(key)
      if (!/^-?\d+$/.test(value)) throw new Error('序列数值格式不完整')
      return BigInt(value).toString()
    }
    const column = text('column_name'),
      seqSchema = text('sequence_schema'),
      seqName = text('sequence_name'),
      identity = text('identity_kind'),
      type = text('data_type')
    if (!columns.some((field) => field.name === column) || sequenceColumns.has(column) || !['', 'a', 'd'].includes(identity) || !['smallint', 'integer', 'bigint'].includes(type))
      throw new Error('序列元数据与字段不匹配')
    const sequence = `${identifier(seqSchema)}.${identifier(seqName)}`
    if (sequenceNames.has(sequence)) throw new Error('不支持共享序列转储，请使用 pg_dump')
    sequenceNames.add(sequence)
    sequenceColumns.add(column)
    schemas.add(seqSchema)
    const start = integer('start_value'),
      min = integer('min_value'),
      max = integer('max_value'),
      increment = integer('increment_by'),
      cache = integer('cache_size')
    const cycle = cell('cycle')
    if (typeof cycle !== 'boolean' || cell('readable') !== true) throw new Error('没有序列读取权限，无法完整转储')
    const options = `AS ${type} INCREMENT BY ${increment} MINVALUE ${min} MAXVALUE ${max} START WITH ${start} CACHE ${cache} ${cycle ? 'CYCLE' : 'NO CYCLE'}`
    if (!identity) {
      before.push(`CREATE SEQUENCE ${sequence} ${options};`)
      after.push(`ALTER SEQUENCE ${sequence} OWNED BY ${target}.${identifier(column)};`)
    } else {
      // IDENTITY 的实际序列名由目标 CREATE TABLE 生成，不能假定与源端自定义名称相同。
      const command = `EXECUTE 'ALTER SEQUENCE ' || pg_catalog.pg_get_serial_sequence(${literal(target)},${literal(column)}) || ${literal(' ' + options)};`
      let tag = '$sql_studio_sequence$'
      while (command.includes(tag)) tag = tag.slice(0, -1) + '_$'
      after.push(`DO ${tag} BEGIN ${command} END; ${tag};`)
    }
    const last = cell('last_value')
    if (last !== null && (typeof last !== 'string' || !/^-?\d+$/.test(last))) throw new Error('序列当前位置不完整')
    resets.push(
      `SELECT pg_catalog.setval(pg_catalog.pg_get_serial_sequence(${literal(target)},${literal(column)})::regclass, ${last === null ? start : BigInt(last).toString()}, ${last === null ? 'FALSE' : 'TRUE'});`
    )
  }
  for (const column of columns) {
    if ((/IDENTITY/i.test(column.extra) || /\bnextval\s*\(/i.test(column.default || '')) && !sequenceColumns.has(column.name)) throw new Error('存在外部或不可读取的序列，请使用 pg_dump 完整导出')
  }
  if (
    new Set(result.columns.map((field) => field.name)).size !== result.columns.length ||
    result.columns.length !== columns.length ||
    columns.some((column) => !result.columns.some((field) => field.name === column.name))
  )
    throw new Error('表结构与数据列不一致，请重新导出')
  const fields = result.columns
    .map((field, index) => ({ field, index, definition: columns.find((column) => column.name === field.name)! }))
    .filter(({ definition }) => !/GENERATED/i.test(definition.extra))
  const overriding = fields.some(({ definition }) => /IDENTITY/i.test(definition.extra)) ? ' OVERRIDING SYSTEM VALUE' : ''
  const inserts = result.rows.map((row) => {
    if (row.length !== result.columns.length) throw new Error('行数据不完整')
    return fields.length
      ? `INSERT INTO ${target} (${fields.map(({ field }) => identifier(field.name)).join(', ')})${overriding} VALUES (${fields.map(({ field, index }) => valueSQL(row[index], field.type)).join(', ')});`
      : `INSERT INTO ${target} DEFAULT VALUES;`
  })
  return [
    `-- PostgreSQL database: ${database.replace(/[\r\n]/g, ' ')}`,
    '-- 单表结构和数据；依赖对象需预先存在；导出期间请避免并发写入',
    ...[...schemas].map((name) => `CREATE SCHEMA IF NOT EXISTS ${identifier(name)};`),
    ...before,
    ddl.trim(),
    ...after,
    ...inserts,
    ...resets,
    ''
  ].join('\n')
}

export const dataDump = { querySQL, metadataSQL, dump }
