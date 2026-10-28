import type { DatabaseAdapter } from '../typings'
import { postgresqlCompletion } from './completion'
import { referencedTables } from './context'
import { canInsertColumn, insertRowSQL, updateCellSQL } from './dataEditing'
import { simpleObjects } from './objectManagement'
import { postgresqlProfile } from './profile'
import { explorerTableIdentity, exportDDL, schemaListResult, tableDataSQL, tableInSchema, tableLabel, tableListResult } from './query'
import { cleanPostgreSQLHistory, splitPostgreSQLStatements } from './statements'
import { tableDesign } from './tableDesign'

const postgresql = {
  profile: postgresqlProfile,
  explorer: { tableIdentity: explorerTableIdentity, tableInSchema, schemaListResult, referencedTables },
  objects: undefined,
  simpleObjects,
  tableDesign,
  canInsertColumn,
  insertRowSQL,
  updateCellSQL,
  isSQLColumn: (name: string) => /^(?:DDL|SQL|Statement|Query|pg_get_viewdef|pg_get_indexdef)$/i.test(name.trim()),
  splitStatements: splitPostgreSQLStatements,
  cleanHistory: cleanPostgreSQLHistory,
  useDatabase: () => undefined,
  tableDataSQL,
  tableLabel,
  tableListResult,
  completion: postgresqlCompletion,
  exportDDL
} satisfies DatabaseAdapter
export default postgresql
