import type { DatabaseType } from '@/typings/database'

/** 当前仅支持 MySQL。 */
export const databaseTypes: { value: DatabaseType; label: string; description: string; className: string; port: number }[] = [
  { value: 'mysql', label: 'MySQL', description: 'MySQL 数据库', className: 'engine-mysql', port: 3306 }
]
export const databaseTypeInfo = (_type?: DatabaseType) => databaseTypes[0]

export const defaultConnectionGroup = '默认分组'
/** 空分组及旧连接使用同一显示名称，不改变连接 ID。 */
export const connectionGroupName = (group?: string) => group?.trim() || defaultConnectionGroup
