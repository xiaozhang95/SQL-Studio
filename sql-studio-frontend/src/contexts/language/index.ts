import { createContext } from 'react'

import type { Language } from '@/typings/theme'

export const LanguageContext = createContext<Language>('zh-CN')
