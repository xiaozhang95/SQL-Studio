import type { DatabaseAdapter } from '../typings'
import { oracleCompletion } from './completion'
import { dataDump, prepareDump } from './dataDump'
import { canInsertColumn, deleteRowSQL, insertRowSQL, updateRowSQL } from './dataEditing'
import { simpleObjects } from './objectManagement'
import { oracleProfile } from './profile'
import { exportDDL, referencedTables, schemaListResult, tableDataSQL, tableIdentity, tableInSchema, tableLabel, tableListResult } from './query'
import { cleanOracleHistory, splitOracleStatements } from './statements'
import { tableDesign } from './tableDesign'

const oracle = {
  sessionBatch: true,
  objectSQLBatch: true,
  batchStatementRequiresSession: true,
  foreignKeys: true,
  profile: oracleProfile,
  explorer: { tableIdentity, tableInSchema, schemaListResult, referencedTables },
  objects: undefined,
  simpleObjects,
  tableDesign,
  dataEditing: { canInsertColumn, insertRowSQL, deleteRowSQL, updateRowSQL },
  dumpFile: {
    header: (service) => '-- Oracle service: ' + service.replace(/[\r\n]/g, ' ') + '\n-- Target schemas and external dependencies must already exist.\n\n',
    footer: '',
    prepare: prepareDump
  },
  dataDump,
  isSQLColumn: (name) => /^(?:DDL|SQL|Statement|Query|SQL_TEXT|VIEW_DEFINITION)$/i.test(name.trim()),
  splitStatements: splitOracleStatements,
  useDatabase: () => undefined,
  cleanHistory: cleanOracleHistory,
  tableDataSQL,
  tableLabel,
  tableListResult,
  completion: oracleCompletion,
  exportDDL
} satisfies DatabaseAdapter

export default oracle
