import { MariaSQL, sql } from '@codemirror/lang-sql'

import type { SQLCompletionContext } from '../../typings'

export function mariadbCompletion({ database, table, schema }: SQLCompletionContext) {
  return sql({ dialect: MariaSQL, upperCaseKeywords: true, defaultSchema: database || undefined, defaultTable: table || undefined, schema })
}
