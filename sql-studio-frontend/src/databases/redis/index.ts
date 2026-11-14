import redisIcon from '@/assets/databases/redis.svg'

import { DatabaseEngine } from '../typings'
import type { DatabaseProfile } from '../typings'

export const redisProfile = {
  value: DatabaseEngine.Redis,
  label: 'Redis',
  description: 'Redis',
  className: 'engine-redis',
  port: 6379,
  database: '0',
  optionalUsername: true,
  icon: redisIcon
} as const satisfies DatabaseProfile
/** Return a logical database only after metadata has confirmed it is available. */
export function selectedRedisDatabase(names: readonly string[], current?: string, preferred?: string) {
  return [current, preferred].find((name) => name !== undefined && names.includes(name)) ?? names[0]
}
