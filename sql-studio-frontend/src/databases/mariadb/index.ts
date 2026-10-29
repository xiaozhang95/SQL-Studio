import mysql from '../mysql'
import type { DatabaseAdapter } from '../typings'
import { mariadbCompletion } from './completion'
import { mariadbObjects } from './objectManagement'
import { mariadbProfile } from './profile'
import { splitMariaDBStatements, useMariaDBDatabase } from './statements'

/** 协议相同的功能显式复用，MariaDB 的配置、元数据及方言单独拥有。 */
const mariadb = {
  ...mysql,
  profile: mariadbProfile,
  objects: mariadbObjects,
  completion: mariadbCompletion,
  splitStatements: splitMariaDBStatements,
  useDatabase: useMariaDBDatabase,
  dumpFile: {
    ...mysql.dumpFile,
    header: (database, schemas, metadata) => '-- MariaDB 转储；不包含独立序列及系统版本历史\n' + mysql.dumpFile.header(database, schemas, metadata),
    prepare: (database, table, ddl, columns, _metadata, withData) => {
      if (withData && /\bWITH\s+SYSTEM\s+VERSIONING\b/i.test(ddl)) throw new Error('系统版本表请使用 mariadb-dump 导出完整历史')
      return mysql.dumpFile.prepare(database, table, ddl, columns)
    }
  }
} satisfies DatabaseAdapter

export default mariadb
