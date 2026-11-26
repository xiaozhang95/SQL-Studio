import type { DBTable, QueryResult } from '../../../typings/database/index.ts'
import { oracleTokens } from '../statements/index.ts'

export function identifier(value: string) {
  if (!value.trim() || value.includes('\0') || new TextEncoder().encode(value).length > 128) throw new Error('Oracle 名称不能为空，且最多 128 个 UTF-8 字节')
  return '"' + value.replaceAll('"', '""') + '"'
}

export function tableIdentity(table: string) {
  const match = /^"((?:""|[^"])+)"\."((?:""|[^"])+)"$/.exec(table)
  if (!match) throw new Error('表标识无效，请重新打开表')
  return { schema: match[1].replaceAll('""', '"'), name: match[2].replaceAll('""', '"') }
}

export function tableInSchema(table: string, schema: string) {
  return identifier(schema) + '.' + identifier(tableIdentity(table).name)
}

export function relation(table: string) {
  const { schema, name } = tableIdentity(table)
  return identifier(schema) + '.' + identifier(name)
}

export function tableLabel(table: string) {
  const { schema, name } = tableIdentity(table)
  return [schema, name].map((value) => (/^[A-Z][A-Z0-9_$#]*$/.test(value) ? value : identifier(value))).join('.')
}

export function tableDataSQL(_database: string, table: string, { preview = true } = {}) {
  return 'SELECT * FROM ' + relation(table) + (preview ? ' FETCH FIRST 1000 ROWS ONLY' : '') + ';'
}

export const schemaListResult = (schemas: readonly string[]): Pick<QueryResult, 'columns' | 'rows'> => ({ columns: [{ name: 'Schema', type: '' }], rows: schemas.map((schema) => [schema]) })

export function tableListResult(tables: readonly DBTable[], schema?: string): Pick<QueryResult, 'columns' | 'rows'> {
  return {
    columns: ['Schema', '表名', '类型', '注释'].map((name) => ({ name, type: '' })),
    rows: tables.flatMap((table) => {
      const identity = tableIdentity(table.name)
      return schema && identity.schema !== schema ? [] : [[identity.schema, identity.name, table.type, table.comment]]
    })
  }
}

export function referencedTables(sql: string, tables: readonly DBTable[], schema?: string): ReadonlySet<string> {
  const tokens = [...oracleTokens(sql)]
  const references = new Set<string>()
  const isName = (token?: (typeof tokens)[number]) => token?.kind === 'word' || token?.kind === 'identifier'
  for (let i = 0; i < tokens.length - 1; i++) {
    const [word, first, dot, second] = tokens.slice(i, i + 4)
    if (word.kind !== 'word' || !['FROM', 'JOIN', 'UPDATE', 'INTO', 'TABLE'].includes(word.text) || !isName(first)) continue
    if (dot?.kind === 'symbol' && dot.text === '.' && isName(second)) references.add(JSON.stringify([first.text, second.text]))
    else references.add(JSON.stringify([schema || '', first.text]))
  }
  return new Set(
    tables
      .filter(({ name }) => {
        const table = tableIdentity(name)
        return references.has(JSON.stringify([table.schema, table.name])) || (!schema && references.has(JSON.stringify(['', table.name])))
      })
      .map(({ name }) => name)
  )
}

export const textLiteral = (value: string) => "'" + value.replaceAll("'", "''") + "'"

export const exportDDL = (database: string, table: string, ddl: string) => '-- Oracle service: ' + database.replace(/[\r\n]/g, ' ') + '\n-- ' + table.replace(/[\r\n]/g, ' ') + '\n' + ddl.trim() + '\n'
