import type { ComponentType } from 'react'

import greptimedb from './greptimedb'
import GreptimeMonitor from './greptimedb/monitor'
import mariadb from './mariadb'
import MariaDBMonitor from './mariadb/monitor'
import mysql from './mysql'
import MySQLMonitor from './mysql/monitor'
import oracle from './oracle'
import OracleMonitor from './oracle/monitor'
import postgresql from './postgresql'
import PostgreSQLMonitor from './postgresql/monitor'
import { redisProfile } from './redis'
import RedisMonitor from './redis/monitor'
import { DatabaseEngine } from './typings'
import type { DatabaseAdapter, DatabaseMonitorPanelProps, DatabaseProfile, DatabaseType, SQLDatabaseType } from './typings'

const adapters = { [DatabaseEngine.MySQL]: mysql, [DatabaseEngine.MariaDB]: mariadb, [DatabaseEngine.PostgreSQL]: postgresql, [DatabaseEngine.Oracle]: oracle, [DatabaseEngine.GreptimeDB]: greptimedb } satisfies Record<
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

const monitorPanels = {
  [DatabaseEngine.MySQL]: MySQLMonitor,
  [DatabaseEngine.MariaDB]: MariaDBMonitor,
  [DatabaseEngine.PostgreSQL]: PostgreSQLMonitor,
  [DatabaseEngine.Oracle]: OracleMonitor,
  [DatabaseEngine.GreptimeDB]: GreptimeMonitor,
  [DatabaseEngine.Redis]: RedisMonitor
} satisfies Record<DatabaseType, ComponentType<DatabaseMonitorPanelProps>>

/** 监控与 SQL 适配器独立分派；各引擎保留自己的指标语义。 */
export const getDatabaseMonitorPanel = (type: DatabaseType = DatabaseEngine.MySQL): ComponentType<DatabaseMonitorPanelProps> => monitorPanels[type]
