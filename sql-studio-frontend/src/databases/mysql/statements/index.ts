/** MySQL 默认转义规则：仅在字符串、标识符与注释之外按分号切分，保留原 SQL。 */
export function splitSQLStatements(script: string, executableComments: readonly string[] = ['!'], { ansi = false } = {}): string[] {
  const statements: string[] = []
  let start = 0
  let quote = ''
  let lineComment = false
  let blockComment = false
  let hasSQL = false
  const append = (end: number) => {
    if (hasSQL) statements.push(script.slice(start, end).trim())
    start = end
    hasSQL = false
  }
  for (let i = 0; i < script.length; i++) {
    const char = script[i]
    const next = script[i + 1]
    if (lineComment) {
      if (char === '\n' || char === '\r') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (char === '\\' && !ansi) i++
      else if (char === quote) {
        if (next === quote) i++
        else quote = ''
      }
      continue
    }
    if ((!ansi && char === '#') || (char === '-' && next === '-' && (ansi || i + 2 === script.length || script.charCodeAt(i + 2) <= 32))) {
      lineComment = true
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      // MySQL 版本注释含可执行内容，不能当作空白脚本丢弃。
      if (executableComments.some((prefix) => script.startsWith(prefix, i + 2))) hasSQL = true
      i++
      continue
    }
    if (char === ';') append(i + 1)
    else if (!/\s/.test(char)) {
      hasSQL = true
      if (char === "'" || char === '"' || char === '`') quote = char
    }
  }
  if (quote || blockComment) throw new Error('SQL 包含未闭合的引号或注释，请补全后再运行')
  append(script.length)
  return statements
}

/** 仅识别完整 USE；数据库是否存在及访问权限仍由服务端验证。 */
export function useDatabaseSQL(statement: string, { ansi = false } = {}): string | undefined {
  const gap = ansi ? String.raw`(?:\s|/\*(?![!+]|M!)[\s\S]*?\*/|--[^\r\n]*(?:[\r\n]|$))*` : String.raw`(?:\s|/\*(?![!+]|M!)[\s\S]*?\*/|#[^\r\n]*(?:[\r\n]|$)|--(?=[\s]|$)[^\r\n]*(?:[\r\n]|$))*`
  const match = new RegExp('^' + gap + String.raw`USE\b` + gap + '(`(?:``|[^`])+`|[\\p{L}\\p{N}_$]+)' + gap + ';?' + gap + '$', 'iu').exec(statement)
  if (!match) return undefined
  return match[1].startsWith('`') ? match[1].slice(1, -1).replace(/``/g, '`') : match[1]
}
