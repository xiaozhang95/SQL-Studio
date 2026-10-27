import type { AIAdapter } from '../typings'
import { deepseekAPI } from './api'
import { deepseekProfile } from './profile'

export default { profile: deepseekProfile, ...deepseekAPI } satisfies AIAdapter
