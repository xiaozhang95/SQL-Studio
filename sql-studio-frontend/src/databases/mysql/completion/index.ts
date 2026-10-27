import { MySQL, sql } from '@codemirror/lang-sql'

import type { SQLCompletionContext } from '../../typings'

export function mysqlCompletion({ database, table, schema }: SQLCompletionContext) {
  return sql({ dialect: MySQL, upperCaseKeywords: true, defaultSchema: database || undefined, defaultTable: table || undefined, schema })
}
