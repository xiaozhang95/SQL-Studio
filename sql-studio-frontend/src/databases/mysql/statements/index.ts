/** MySQL 默认转义规则：仅在字符串、标识符与注释之外按分号切分，保留原 SQL。 */
export function splitSQLStatements(script: string, executableComments: readonly string[] = ['!'], { ansi = false } = {}): string[] {
  const statements: string[] = []
  let start = 0
  let quote = ''
  let lineComment = false
  let blockComment = false
  let hasSQL = false
  let lineStart = 0
  let commentGaps: number[] = []
  const append = (end: number) => {
    if (hasSQL) {
      const parts: string[] = []
      let from = start
      for (const position of commentGaps) {
        parts.push(script.slice(from, position), ' ')
        from = position
      }
      parts.push(script.slice(from, end))
      statements.push(parts.join('').trim())
    }
    start = end
    hasSQL = false
    commentGaps = []
  }
  for (let i = 0; i < script.length; i++) {
    const char = script[i]
    const next = script[i + 1]
    if (char === '\n' || (ansi && char === '\r')) lineStart = i + 1
    if (lineComment) {
      if (char === '\n' || (ansi && char === '\r')) lineComment = false
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
      if (char === '\\' && !ansi && quote !== '`') i++
      else if (char === quote) {
        if (next === quote) i++
        else quote = ''
      }
      continue
    }
    const dashComment = char === '-' && next === '-'
    const leadingComment = dashComment && /^[\t ]*$/.test(script.slice(lineStart, i))
    const standardComment = i + 2 === script.length || script.charCodeAt(i + 2) <= 32
    if ((!ansi && char === '#') || (dashComment && (ansi || standardComment || leadingComment))) {
      // 编辑器常见的行首 --CREATE 在 MySQL 执行前补空白，行中 1--2 保留运算含义。
      if (!ansi && leadingComment && !standardComment) commentGaps.push(i + 2)
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
  const gap = ansi ? String.raw`(?:\s|/\*(?![!+]|M!)(?:[^*]|\*+[^*/])*\*+/|--[^\r\n]*(?:[\r\n]|$))*` : String.raw`(?:\s|/\*(?![!+]|M!)[\s\S]*?\*/|#[^\n]*(?:\n|$)|--(?=[\x00-\x20]|$)[^\n]*(?:\n|$))*`
  const doubleQuoted = ansi ? '|"(?:""|[^"])+"' : ''
  const identifier = '(`(?:``|[^`])+`|[\\p{L}\\p{N}_$]+' + doubleQuoted + ')'
  const match = new RegExp('^' + gap + String.raw`USE\b` + gap + identifier + gap + ';?' + gap + '$', 'iu').exec(statement)
  if (!match) return undefined
  const [, database] = match
  if (database.startsWith('`')) return database.slice(1, -1).replace(/``/g, '`')
  if (database.startsWith('"')) return database.slice(1, -1).replace(/""/g, '"')
  return database
}
