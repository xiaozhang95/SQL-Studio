import type { DatabaseType } from '@/typings/database'

/** 产品类型与协议分开描述；PolarDB Oracle 兼容版使用 PostgreSQL 协议。 */
export const databaseTypes: { value: DatabaseType; label: string; description: string; className: string; protocol: 'mysql' | 'postgresql'; port: number; username: string }[] = [
  { value: 'mysql', label: 'MySQL', description: 'MySQL 数据库', className: 'engine-mysql', protocol: 'mysql', port: 3306, username: 'root' },
  { value: 'mariadb', label: 'MariaDB', description: 'MariaDB 数据库', className: 'engine-mariadb', protocol: 'mysql', port: 3306, username: 'root' },
  { value: 'polardb-mysql', label: 'PolarDB MySQL', description: '阿里云 PolarDB MySQL 版', className: 'engine-polardb', protocol: 'mysql', port: 3306, username: 'root' },
  { value: 'postgresql', label: 'PostgreSQL', description: 'PostgreSQL 数据库', className: 'engine-postgres', protocol: 'postgresql', port: 5432, username: 'postgres' },
  { value: 'polardb-postgresql', label: 'PolarDB PostgreSQL', description: '阿里云 PolarDB PostgreSQL 版', className: 'engine-polardb', protocol: 'postgresql', port: 5432, username: 'postgres' },
  { value: 'polardb-oracle', label: 'PolarDB Oracle 兼容', description: 'PolarDB PostgreSQL 版（兼容 Oracle）', className: 'engine-oracle', protocol: 'postgresql', port: 5432, username: 'postgres' }
]

export const databaseTypeInfo = (type?: DatabaseType) => databaseTypes.find((item) => item.value === type) || databaseTypes[0]
