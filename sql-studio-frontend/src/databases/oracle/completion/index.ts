import { PLSQL, sql } from '@codemirror/lang-sql'

import type { SQLCompletionContext } from '../../typings'
import { tableIdentity } from '../query'

export function oracleCompletion({ database, table, schema, namespace }: SQLCompletionContext) {
  const namespaces: Record<string, Record<string, string[]>> = Object.create(null)
  for (const [identity, columns] of Object.entries(schema[database] ?? {})) {
    const { schema: owner, name } = tableIdentity(identity)
    ;(namespaces[owner] ??= Object.create(null))[name] = columns
  }
  const selected = table ? tableIdentity(table) : undefined
  return sql({ dialect: PLSQL, upperCaseKeywords: true, schema: namespaces, defaultSchema: selected?.schema ?? namespace, defaultTable: selected?.name })
}
