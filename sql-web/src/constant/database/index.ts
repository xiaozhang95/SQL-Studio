import type { DatabaseType } from '@/typings/database'

/** 当前仅支持 MySQL。 */
export const databaseTypes: { value: DatabaseType; label: string; description: string; className: string; port: number }[] = [
  { value: 'mysql', label: 'MySQL', description: 'MySQL 数据库', className: 'engine-mysql', port: 3306 }
]
export const databaseTypeInfo = (_type?: DatabaseType) => databaseTypes[0]
