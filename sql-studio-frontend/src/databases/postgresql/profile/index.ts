import icon from '@/assets/databases/polardb.svg'

import { DatabaseEngine } from '../../typings'
import type { DatabaseProfile } from '../../typings'

export const postgresqlProfile = {
  value: DatabaseEngine.PostgreSQL,
  label: 'PolarDB PostgreSQL',
  description: 'PostgreSQL 协议，支持阿里云 PolarDB PostgreSQL 版',
  className: 'engine-postgresql',
  port: 5432,
  database: 'postgres',
  icon
} as const satisfies DatabaseProfile
