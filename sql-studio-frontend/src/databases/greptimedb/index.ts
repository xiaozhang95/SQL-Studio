import greptimeDBIcon from '@/assets/databases/greptimedb.svg'

import { mysqlCompletion } from '../mysql/completion'
import { stripHistoryMarkers } from '../mysql/history'
import { tableDataSQL, tableLabel, tableListResult } from '../mysql/query'
import { isSQLColumn } from '../mysql/resultSQL'
import { splitSQLStatements, useDatabaseSQL } from '../mysql/statements'
import { DatabaseEngine } from '../typings'
import type { DatabaseAdapter } from '../typings'

const greptimedb = {
  profile: {
    value: DatabaseEngine.GreptimeDB,
    label: 'GreptimeDB',
    description: 'GreptimeDB 时序数据库',
    className: 'engine-greptimedb',
    port: 4002,
    database: 'public',
    optionalUsername: true,
    icon: greptimeDBIcon
  },
  objects: undefined,
  isSQLColumn,
  tableDataSQL,
  tableLabel,
  tableListResult,
  completion: mysqlCompletion,
  splitStatements: (script) => splitSQLStatements(script, [], { ansi: true }),
  useDatabase: (statement) => useDatabaseSQL(statement, { ansi: true }),
  cleanHistory: stripHistoryMarkers,
  exportDDL: (_database, _table, ddl) => ddl
} satisfies DatabaseAdapter

export default greptimedb
