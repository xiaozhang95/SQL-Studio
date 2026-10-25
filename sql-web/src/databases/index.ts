import mysql from './mysql'
import { DatabaseEngine } from './typings'
import type { DatabaseAdapter, DatabaseType } from './typings'

const adapters = { [DatabaseEngine.MySQL]: mysql } satisfies Record<DatabaseType, DatabaseAdapter>

/** 统一入口仅分派数据库实现，不存放具体方言或品牌定义。 */
export const getDatabaseAdapter = (type: DatabaseType = DatabaseEngine.MySQL): DatabaseAdapter => adapters[type]
