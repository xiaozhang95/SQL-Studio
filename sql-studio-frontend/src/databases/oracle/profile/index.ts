import icon from '@/assets/databases/oracle-brand.png'
import closedIcon from '@/assets/databases/oracle-white.svg'

import { DatabaseEngine } from '../../typings'
import type { DatabaseProfile } from '../../typings'

export const oracleProfile = {
  value: DatabaseEngine.Oracle,
  label: 'Oracle',
  description: 'Oracle 数据库',
  className: 'engine-oracle',
  port: 1521,
  database: 'FREEPDB1',
  databaseLabel: '服务名',
  databaseRequiredMessage: '请输入 Oracle 服务名',
  databaseHelp: '填入监听器注册的服务名，例如 FREEPDB1。连接后可选择 Schema。',
  syncScope: 'schema',
  icon,
  closedIcon
} as const satisfies DatabaseProfile
