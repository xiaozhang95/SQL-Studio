/** 按 MySQL 客户端分隔符切分，保留字符串、标识符和注释中的分隔符。 */
export function splitSQLStatements(script: string, executableComments: readonly string[] = ['!'], { ansi = false } = {}): string[] {
  const statements: string[] = []
  let start = 0
  let quote = ''
  let lineComment = false
  let blockComment = false
  let hasSQL = false
  let lineStart = 0
  let delimiter = ';'
  let commentGaps: number[] = []
  const append = (end: number, nextStart = end) => {
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
    start = nextStart
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
    if (!ansi && !hasSQL && (char === 'D' || char === 'd') && /^[\t ]*$/.test(script.slice(lineStart, i)) && /^delimiter(?:\s|$)/i.test(script.slice(i, i + 10))) {
      const newline = script.indexOf('\n', i)
      const lineEnd = newline === -1 ? script.length : newline
      const value = script.slice(i + 'delimiter'.length, lineEnd).trim()
      if (!value || /\s|["'`\\]|^(?:#|--|\/\*)/.test(value)) throw new Error('DELIMITER 需要有效的 SQL 分隔符')
      delimiter = value
      start = lineEnd
      commentGaps = []
      i = lineEnd - 1
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
    if (script.startsWith(delimiter, i)) {
      const end = i + delimiter.length
      append(delimiter === ';' ? end : i, end)
      i = end - 1
    } else if (!/\s/.test(char)) {
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
