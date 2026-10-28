import type { DatabaseAdapter } from '../typings'
import { mysqlCompletion } from './completion'
import { canInsertColumn, insertRowSQL, updateCellSQL } from './dataEditing'
import { stripHistoryMarkers } from './history'
import { mysqlObjects } from './objectManagement'
import { mysqlProfile } from './profile'
import { tableDataSQL, tableLabel, tableListResult } from './query'
import { isSQLColumn } from './resultSQL'
import { splitSQLStatements, useDatabaseSQL } from './statements'

/** MySQL 的实际实现归属本目录；外层只依赖统一数据库契约。 */
const mysql = {
  isSQLColumn,
  objects: mysqlObjects,
  dataDump: { querySQL: mysqlObjects.dumpQuerySQL, dump: mysqlObjects.dumpWithData },
  exportDDL: mysqlObjects.dump,
  updateCellSQL,
  insertRowSQL,
  canInsertColumn,
  profile: mysqlProfile,
  splitStatements: splitSQLStatements,
  useDatabase: useDatabaseSQL,
  cleanHistory: stripHistoryMarkers,
  tableDataSQL,
  tableLabel,
  tableListResult,
  completion: mysqlCompletion
} satisfies DatabaseAdapter
export default mysql
