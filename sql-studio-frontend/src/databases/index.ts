import greptimedb from './greptimedb'
import mariadb from './mariadb'
import mysql from './mysql'
import postgresql from './postgresql'
import { redisProfile } from './redis'
import { DatabaseEngine } from './typings'
import type { DatabaseAdapter, DatabaseProfile, DatabaseType, SQLDatabaseType } from './typings'

const adapters = { [DatabaseEngine.MySQL]: mysql, [DatabaseEngine.MariaDB]: mariadb, [DatabaseEngine.PostgreSQL]: postgresql, [DatabaseEngine.GreptimeDB]: greptimedb } satisfies Record<
  SQLDatabaseType,
  DatabaseAdapter
>

/** 统一入口仅分派数据库实现，不存放具体方言或品牌定义。 */
export const getDatabaseAdapter = (type: DatabaseType = DatabaseEngine.MySQL): DatabaseAdapter => {
  if (type === DatabaseEngine.Redis) throw new Error('Redis 不支持 SQL')
  return adapters[type]
}

export const getDatabaseProfile = (type?: DatabaseType): DatabaseProfile => (type === DatabaseEngine.Redis ? redisProfile : getDatabaseAdapter(type).profile)
export const sqlDatabaseProfiles = Object.values(adapters).map((adapter) => adapter.profile)
export const databaseProfiles: readonly DatabaseProfile[] = [...sqlDatabaseProfiles, redisProfile]
