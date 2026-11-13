import { englishMessages } from '../../constant/translations/index.ts'
import type { Language } from '../../typings/theme/index.ts'

export type TranslationValues = Readonly<Record<string, string | number>>

const placeholder = /\{(\w+)\}/g
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const templates = Object.entries(englishMessages)
  .flatMap(([source, english]) => {
    const fields = [...source.matchAll(placeholder)]
    if (!fields.length) return []
    let previous = 0
    let pattern = '^'
    let specificity = 0
    const names: string[] = []
    for (const field of fields) {
      const literal = source.slice(previous, field.index)
      pattern += escapePattern(literal) + '(.*?)'
      specificity += literal.length
      names.push(field[1])
      previous = field.index + field[0].length
    }
    const end = source.slice(previous)
    return [{ match: new RegExp(pattern + escapePattern(end) + '$', 's'), names, english, specificity: specificity + end.length }]
  })
  .sort((a, b) => b.specificity - a.specificity)

/** Match whole known messages, including dynamic text from non-React utilities. */
function englishText(message: string): string | undefined {
  if (Object.hasOwn(englishMessages, message)) return englishMessages[message]
  for (const template of templates) {
    const match = template.match.exec(message)
    if (match) {
      const values = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]))
      return template.english.replace(placeholder, (field, name: string) => values[name] ?? field)
    }
  }
  return undefined
}

export function translate(message: string, language: Language, values?: TranslationValues): string {
  const key = message.trim()
  const english = language === 'en-US' ? englishText(key) : undefined
  const translated = language === 'en-US' && english !== undefined ? message.replace(key, () => english) : message
  return values ? translated.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder)) : translated
}
