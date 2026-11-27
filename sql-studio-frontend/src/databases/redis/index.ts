import redisIcon from '@/assets/databases/redis-brand.png'
import type { RedisConnectionMode } from '@/typings/database'

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
  icon: redisIcon,
  closedIconMaskFilter: 'grayscale(1) brightness(0.7) contrast(2.5)'
} as const satisfies DatabaseProfile

export const redisModeLabels = { standalone: '单机', sentinel: '哨兵', cluster: '集群' } as const satisfies Record<RedisConnectionMode, string>

export function redisModeLabel(mode?: string) {
  if (mode === 'sentinel' || mode === 'cluster') return redisModeLabels[mode]
  return redisModeLabels.standalone
}

/** Return a logical database only after metadata has confirmed it is available. */
export function selectedRedisDatabase(names: readonly string[], current?: string, preferred?: string) {
  return [current, preferred].find((name) => name !== undefined && names.includes(name)) ?? names[0]
}
