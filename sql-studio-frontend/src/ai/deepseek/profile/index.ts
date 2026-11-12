import { AIProvider } from '../../typings'
import type { AIAdapter } from '../../typings'
import deepseekLogo from '../assets/logo.svg'

export const deepseekProfile = {
  value: AIProvider.DeepSeek,
  label: 'DeepSeek',
  defaultModel: 'deepseek-flash',
  icon: deepseekLogo
} as const satisfies AIAdapter['profile']
