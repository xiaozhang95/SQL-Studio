/** PostgreSQL lexical boundaries: dollar quotes, E strings and nested block comments. */
function scan(script: string, removeMarkers: boolean) {
  const statements: string[] = []
  let output = '',
    start = 0,
    quote = '',
    dollar = '',
    block = 0,
    line = false,
    escaped = false,
    hasSQL = false
  const append = (end: number) => {
    if (hasSQL) statements.push(script.slice(start, end).trim())
    start = end
    hasSQL = false
  }
  for (let i = 0; i < script.length; i++) {
    const char = script[i],
      next = script[i + 1]
    if (dollar) {
      if (script.startsWith(dollar, i)) {
        i += dollar.length - 1
        dollar = ''
      }
      continue
    }
    if (line) {
      if (char === '\n' || char === '\r') line = false
      continue
    }
    if (block) {
      if (char === '/' && next === '*') {
        block++
        i++
      } else if (char === '*' && next === '/') {
        block--
        i++
      }
      continue
    }
    if (quote) {
      if (escaped && char === '\\') i++
      else if (char === quote) {
        if (next === quote) i++
        else quote = ''
      }
      continue
    }
    if (removeMarkers && (i === 0 || /[\r\n]/.test(script[i - 1]))) {
      const marker = /^[\t \uFEFF]*-- 历史记录[\t ]*(?:\r\n|[\r\n]|$)/.exec(script.slice(i))
      if (marker) {
        output += script.slice(start, i)
        i += marker[0].length - 1
        start = i + 1
        continue
      }
    }
    if (char === '-' && next === '-') {
      line = true
      i++
      continue
    }
    if (char === '/' && next === '*') {
      block = 1
      i++
      continue
    }
    if (char === '$' && (i === 0 || !/[\p{L}\p{N}_$]/u.test(script[i - 1]))) {
      const tag = /^\$(?:[\p{L}_][\p{L}\p{N}_]*)?\$/u.exec(script.slice(i))
      if (tag) {
        dollar = tag[0]
        i += dollar.length - 1
        hasSQL = true
        continue
      }
    }
    if (char === "'" || char === '"') {
      quote = char
      escaped = char === "'" && /e/i.test(script[i - 1] || '') && (i < 2 || !/[\p{L}\p{N}_$]/u.test(script[i - 2]))
      hasSQL = true
    } else if (char === ';' && !removeMarkers) append(i + 1)
    else if (!/\s/.test(char)) hasSQL = true
  }
  if (!removeMarkers && (quote || dollar || block)) throw new Error('SQL 包含未闭合的引号、美元引号或注释')
  if (removeMarkers) return { statements, cleaned: (output + script.slice(start)).trim() }
  append(script.length)
  return { statements, cleaned: script.trim() }
}
export const splitPostgreSQLStatements = (script: string) => scan(script, false).statements
export const cleanPostgreSQLHistory = (script: string) => scan(script, true).cleaned
