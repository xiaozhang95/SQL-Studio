import type { DatabaseAdapter } from '../typings'
import { mysqlCompletion } from './completion'
import { dumpData } from './dataDump'
import { canInsertColumn, deleteRowSQL, insertRowSQL, updateCellSQL } from './dataEditing'
import { stripHistoryMarkers } from './history'
import { mysqlObjects } from './objectManagement'
import { mysqlProfile } from './profile'
import { tableDataSQL, tableLabel, tableListResult } from './query'
import { isSQLColumn } from './resultSQL'
import { splitSQLStatements, useDatabaseSQL } from './statements'

/** MySQL 的实际实现归属本目录；外层只依赖统一数据库契约。 */
const mysql = {
  isSQLColumn,
  dumpFile: {
    metadataSQL: mysqlObjects.databaseInfoSQL,
    header: (database, _schemas, metadata) => {
      if (!metadata) throw new Error('数据库属性不完整')
      const definition = mysqlObjects.databaseDefinition(metadata)
      const option = (value: string) => {
        if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error('数据库字符集属性不完整')
        return value
      }
      const quoted = '`' + database.replaceAll('`', '``') + '`'
      return `-- SQL Studio 表/视图转储；不包含例程、触发器、事件和权限；跨表不保证同一快照\nCREATE DATABASE IF NOT EXISTS ${quoted} CHARACTER SET ${option(definition.charset)} COLLATE ${option(definition.collation)};\nUSE ${quoted};\nSET @sql_studio_old_fk = @@SESSION.FOREIGN_KEY_CHECKS;\nSET FOREIGN_KEY_CHECKS = 0;\nSET @sql_studio_old_sql_mode = @@SESSION.sql_mode;\nSET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode, 'NO_AUTO_VALUE_ON_ZERO');\n`
    },
    footer: 'SET SESSION sql_mode = @sql_studio_old_sql_mode;\nSET FOREIGN_KEY_CHECKS = @sql_studio_old_fk;\n',
    prepare: (database, table, ddl, columns) => ({
      before: mysqlObjects.dump(database, table, ddl),
      after: '',
      data: (result) => {
        if (result.columns.length !== columns.length || columns.some((column) => !result.columns.some((field) => field.name === column.name))) throw new Error('表结构与数据列不一致，请重新导出')
        return dumpData(database, table, result, columns)
      }
    })
  },
  objects: mysqlObjects,
  dataDump: { querySQL: mysqlObjects.dumpQuerySQL, dump: mysqlObjects.dumpWithData },
  exportDDL: mysqlObjects.dump,
  updateCellSQL,
  insertRowSQL,
  deleteRowSQL,
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
