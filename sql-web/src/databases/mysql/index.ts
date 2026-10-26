import type { DatabaseAdapter } from '../typings'
import { mysqlCompletion } from './completion'
import { canInsertColumn, insertRowSQL, updateCellSQL } from './dataEditing'
import { stripHistoryMarkers } from './history'
import { mysqlObjects } from './objectManagement'
import { mysqlProfile } from './profile'
import { tableDataSQL } from './query'
import { splitSQLStatements } from './statements'

/** MySQL 的实际实现归属本目录；外层只依赖统一数据库契约。 */
const mysql = {
  objects: mysqlObjects,
  updateCellSQL,
  insertRowSQL,
  canInsertColumn,
  profile: mysqlProfile,
  splitStatements: splitSQLStatements,
  cleanHistory: stripHistoryMarkers,
  tableDataSQL,
  completion: mysqlCompletion
} satisfies DatabaseAdapter
export default mysql
