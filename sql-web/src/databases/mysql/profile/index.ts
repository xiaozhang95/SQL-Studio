import mysqlDolphin from '@/assets/databases/mysql-dolphin.svg'

import { DatabaseEngine } from '../../typings'
import type { DatabaseProfile } from '../../typings'

export const mysqlProfile = {
  value: DatabaseEngine.MySQL,
  label: 'MySQL',
  description: 'MySQL 数据库',
  className: 'engine-mysql',
  port: 3306,
  icon: mysqlDolphin
} as const satisfies DatabaseProfile
