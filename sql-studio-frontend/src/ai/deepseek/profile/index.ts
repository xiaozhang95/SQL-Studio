import { AIProvider } from '../../typings'
import type { AIAdapter } from '../../typings'
import deepseekDark from '../assets/logo-mark-dark.svg'
import deepseekLight from '../assets/logo-mark-light.svg'

export const deepseekProfile = {
  value: AIProvider.DeepSeek,
  label: 'DeepSeek',
  defaultModel: 'deepseek-flash',
  icon: deepseekLight,
  darkIcon: deepseekDark
} as const satisfies AIAdapter['profile']
