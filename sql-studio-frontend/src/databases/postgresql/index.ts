import type { DatabaseAdapter } from '../typings'
import { postgresqlCompletion } from './completion'
import { referencedTables } from './context'
import { sql as databaseSQL, definition, metadataSQL } from './databaseProperties'
import DatabasePropertiesForm from './databaseProperties/components/form'
import { dataDump, prepareDump } from './dataDump'
import { canInsertColumn, deleteRowSQL, insertRowSQL, updateCellSQL } from './dataEditing'
import { simpleObjects } from './objectManagement'
import { postgresqlProfile } from './profile'
import { explorerTableIdentity, exportDDL, schemaListResult, tableDataSQL, tableInSchema, tableLabel, tableListResult } from './query'
import { cleanPostgreSQLHistory, splitPostgreSQLStatements } from './statements'
import { tableDesign } from './tableDesign'

const postgresql = {
  profile: postgresqlProfile,
  foreignKeys: true,
  dumpFile: {
    header: (database, schemas) =>
      `-- PostgreSQL database: ${database.replace(/[\r\n]/g, ' ')}\n-- 表/视图结构与数据；库/Schema 转储不包含扩展管理的对象，相关扩展、外部类型、函数、授权需预先存在；跨表不保证同一快照\n` +
      schemas
        .filter((schema) => !schema.startsWith('pg_') && schema !== 'information_schema')
        .map((schema) => `CREATE SCHEMA IF NOT EXISTS "${schema.replaceAll('"', '""')}";`)
        .join('\n') +
      '\n',
    footer: '',
    prepare: prepareDump
  },
  explorer: { tableIdentity: explorerTableIdentity, tableInSchema, schemaListResult, referencedTables },
  objects: undefined,
  databaseEditor: { metadataSQL, definition, sql: databaseSQL, Form: DatabasePropertiesForm },
  dataDump,
  simpleObjects,
  tableDesign,
  dataEditing: { canInsertColumn, deleteRowSQL, insertRowSQL, updateCellSQL },
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
