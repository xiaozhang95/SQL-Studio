import { useCallback, useContext } from 'react'

import { LanguageContext } from '@/contexts/language'
import { translate } from '@/utils/translate'
import type { TranslationValues } from '@/utils/translate'

export function useTranslation() {
  const language = useContext(LanguageContext)
  const t = useCallback((message: string, values?: TranslationValues) => translate(message, language, values), [language])
  return { language, t }
}
