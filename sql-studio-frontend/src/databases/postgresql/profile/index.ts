import icon from '@/assets/databases/postgresql.svg'

import { DatabaseEngine } from '../../typings'
import type { DatabaseProfile } from '../../typings'

export const postgresqlProfile = {
  value: DatabaseEngine.PostgreSQL,
  label: 'PostgreSQL',
  description: 'PostgreSQL 数据库',
  className: 'engine-postgresql',
  port: 5432,
  database: 'postgres',
  icon
} as const satisfies DatabaseProfile
