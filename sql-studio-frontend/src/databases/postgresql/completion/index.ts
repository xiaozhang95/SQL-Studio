import { PostgreSQL, sql } from '@codemirror/lang-sql'

import type { SQLCompletionContext } from '../../typings'
import { tableIdentity } from '../query/index.ts'

export function postgresqlCompletion({ database, table, schema, namespace }: SQLCompletionContext) {
  const namespaces: Record<string, Record<string, string[]>> = {}
  for (const [name, columns] of Object.entries(schema[database] || {})) {
    const [namespace, relation] = tableIdentity(name)
    ;(namespaces[namespace] ??= {})[relation] = columns
  }
  const [defaultSchema, defaultTable] = table ? tableIdentity(table) : [namespace || 'public', undefined]
  return sql({ dialect: PostgreSQL, upperCaseKeywords: true, schema: namespaces, defaultSchema, defaultTable })
}
