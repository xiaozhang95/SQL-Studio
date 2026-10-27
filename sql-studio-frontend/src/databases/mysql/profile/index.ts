import mysqlIcon from '@/assets/databases/mysql-official.svg'

import { DatabaseEngine } from '../../typings'
import type { DatabaseProfile } from '../../typings'

export const mysqlProfile = {
  value: DatabaseEngine.MySQL,
  label: 'MySQL',
  description: 'MySQL 数据库',
  className: 'engine-mysql',
  port: 3306,
  iconPresentation: 'brand',
  icon: mysqlIcon
} as const satisfies DatabaseProfile
