import type { Language } from '../../typings/theme/index.ts'

/** Read the applied UI language without maintaining a second mutable preference. */
export function getLanguage(): Language {
  return typeof document !== 'undefined' && document.documentElement?.lang === 'en-US' ? 'en-US' : 'zh-CN'
}
