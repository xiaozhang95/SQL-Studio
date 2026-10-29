import mariadb from './mariadb'
import mysql from './mysql'
import postgresql from './postgresql'
import { DatabaseEngine } from './typings'
import type { DatabaseAdapter, DatabaseProfile, DatabaseType } from './typings'

const adapters = { [DatabaseEngine.MySQL]: mysql, [DatabaseEngine.MariaDB]: mariadb, [DatabaseEngine.PostgreSQL]: postgresql } satisfies Record<DatabaseType, DatabaseAdapter>

/** 统一入口仅分派数据库实现，不存放具体方言或品牌定义。 */
export const getDatabaseAdapter = (type: DatabaseType = DatabaseEngine.MySQL): DatabaseAdapter => adapters[type]

export const databaseProfiles: readonly DatabaseProfile[] = Object.values(adapters).map((adapter) => adapter.profile)
