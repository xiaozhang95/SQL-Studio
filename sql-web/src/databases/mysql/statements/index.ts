/** MySQL 默认转义规则：仅在字符串、标识符与注释之外按分号切分，保留原 SQL。 */
export function splitSQLStatements(script: string): string[] {
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
      if (char === '\\') i++
      else if (char === quote) {
        if (next === quote) i++
        else quote = ''
      }
      continue
    }
    if (char === '#' || (char === '-' && next === '-' && (i + 2 === script.length || script.charCodeAt(i + 2) <= 32))) {
      lineComment = true
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      // MySQL 版本注释含可执行内容，不能当作空白脚本丢弃。
      if (script[i + 2] === '!') hasSQL = true
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
