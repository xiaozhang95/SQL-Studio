import type { DBTable } from '../../../typings/database/index.ts'
import { tableIdentity } from '../query/index.ts'

/** Ignore strings/comments before recognizing relation references; incomplete drafts are accepted. */
function identifiers(script: string) {
  const chars = script.split('')
  for (let i = 0; i < script.length;) {
    const start = i,
      char = script[i],
      pair = script.slice(i, i + 2)
    if (pair === '--') {
      while (i < script.length && !/[\r\n]/.test(script[i])) i++
    } else if (pair === '/*') {
      let depth = 1
      i += 2
      while (i < script.length && depth) {
        if (script.slice(i, i + 2) === '/*') {
          depth++
          i += 2
        } else if (script.slice(i, i + 2) === '*/') {
          depth--
          i += 2
        } else i++
      }
    } else if (char === "'") {
      const escaped = i > 0 && /[eE]/.test(script[i - 1]) && (i < 2 || !/[\p{L}\p{N}_$]/u.test(script[i - 2]))
      i++
      while (i < script.length) {
        if (escaped && script[i] === '\\') {
          i += 2
          continue
        }
        if (script[i++] === "'") {
          if (script[i] === "'") {
            i++
            continue
          }
          break
        }
      }
    } else if (char === '$' && (i === 0 || !/[\p{L}\p{N}_$]/u.test(script[i - 1]))) {
      const tag = /^\$(?:[\p{L}_][\p{L}\p{N}_]*)?\$/u.exec(script.slice(i))
      if (!tag) {
        i++
        continue
      }
      const end = script.indexOf(tag[0], i + tag[0].length)
      i = end < 0 ? script.length : end + tag[0].length
    } else if (char === '"') {
      i++
      while (i < script.length) {
        if (script[i++] === '"') {
          if (script[i] === '"') {
            i++
            continue
          }
          break
        }
      }
      continue
    } else {
      i++
      continue
    }
    chars.fill(' ', start, i)
  }
  return [...chars.join('').matchAll(/"((?:""|[^"])*)"|([\p{L}_][\p{L}\p{N}_$]*)|([.(),])/gu)].map((match) => ({
    name: match[1] !== undefined ? match[1].replaceAll('""', '"') : (match[2] || match[3]).toLowerCase(),
    quoted: match[1] !== undefined
  }))
}
export function referencedTables(sql: string, tables: readonly DBTable[], schema = 'public'): ReadonlySet<string> {
  const refs = new Set<string>(),
    tokens = identifiers(sql)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].quoted || !['from', 'join', 'update', 'into', 'table', 'truncate'].includes(tokens[i].name)) continue
    let next = i + 1
    if (tokens[next]?.name === 'only' && !tokens[next].quoted) next++
    const first = tokens[next]
    if (!first || (!first.quoted && /^[.(),]$/.test(first.name))) continue
    const second = tokens[next + 1]?.name === '.' ? tokens[next + 2] : undefined
    if (second) refs.add(JSON.stringify([first.name, second.name]))
    else refs.add(JSON.stringify([schema || 'public', first.name]))
  }
  return new Set(tables.filter((table) => refs.has(JSON.stringify(tableIdentity(table.name)))).map((table) => table.name))
}
