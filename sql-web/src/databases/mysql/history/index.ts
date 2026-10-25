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
