import icon from '@/assets/databases/postgresql-brand.svg'
import closedIcon from '@/assets/databases/postgresql-white.svg'

import { DatabaseEngine } from '../../typings'
import type { DatabaseProfile } from '../../typings'

export const postgresqlProfile = {
  value: DatabaseEngine.PostgreSQL,
  label: 'PostgreSQL',
  description: 'PostgreSQL 数据库',
  className: 'engine-postgresql',
  port: 5432,
  database: 'postgres',
  icon,
  closedIcon
} as const satisfies DatabaseProfile
