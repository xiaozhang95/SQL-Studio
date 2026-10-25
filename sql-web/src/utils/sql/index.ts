export const identifier = (name: string) => '`' + name.replaceAll('`', '``') + '`'

/** 历史来源标记仅用于编辑器展示；保留字符串、标识符和其他注释内的同名内容。 */
export function stripHistoryMarkers(script: string): string {
  let quote = ''
  let blockComment = false
  let lineComment = false
  let output = ''
  let start = 0
  for (let i = 0; i < script.length; i++) {
    const char = script[i]
    const next = script[i + 1]
    if (!quote && !blockComment && !lineComment && (i === 0 || script[i - 1] === '\n' || script[i - 1] === '\r')) {
      const marker = /^[\t \uFEFF]*-- 历史记录[\t ]*(?:\r\n|[\r\n]|$)/.exec(script.slice(i))
      if (marker) {
        output += script.slice(start, i)
        i += marker[0].length - 1
        start = i + 1
        continue
      }
    }
    if (lineComment) {
      if (char === '\n' || char === '\r') lineComment = false
    } else if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        i++
      }
    } else if (quote) {
      if (char === '\\') i++
      else if (char === quote) {
        if (next === quote) i++
        else quote = ''
      }
    } else if (char === '#' || (char === '-' && next === '-' && (i + 2 === script.length || script.charCodeAt(i + 2) <= 32))) lineComment = true
    else if (char === '/' && next === '*') {
      blockComment = true
      i++
    } else if (char === "'" || char === '"' || char === '`') quote = char
  }
  return (output + script.slice(start)).trim()
}

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

/** 原样导出完整草稿，文件名兼容常见桌面文件系统。 */
export function exportSQL(statement: string, title: string) {
  const filename =
    Array.from(title.replace(/\.sql$/i, ''), (char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
      .join('')
      .replace(/[.\s]+$/g, '')
      .slice(0, 120) || 'query'
  const url = URL.createObjectURL(new Blob([statement], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.sql`
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    // 下载接管后再释放 Blob，避免部分浏览器尚未读取文件时撤销 URL。
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
