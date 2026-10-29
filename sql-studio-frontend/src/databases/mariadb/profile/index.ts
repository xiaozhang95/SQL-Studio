import mariadbIcon from '@/assets/databases/mariadb.svg'

import { DatabaseEngine } from '../../typings'
import type { DatabaseProfile } from '../../typings'

export const mariadbProfile = {
  value: DatabaseEngine.MariaDB,
  label: 'MariaDB',
  description: 'MariaDB 数据库',
  className: 'engine-mariadb',
  port: 3306,
  icon: mariadbIcon
} as const satisfies DatabaseProfile
