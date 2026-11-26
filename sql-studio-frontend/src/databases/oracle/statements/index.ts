type Token = { kind: 'word' | 'identifier' | 'literal' | 'symbol'; text: string; start: number; end: number }

const alternativeDelimiters: Readonly<Record<string, string>> = { '[': ']', '(': ')', '{': '}', '<': '>' }
const isWord = /[\p{L}\p{N}_$#]/u
const incompleteSQL = 'Oracle 脚本存在未闭合的字符串、标识符或注释'

export function* oracleTokens(sql: string, strict = false): Generator<Token> {
  for (let i = 0; i < sql.length;) {
    const start = i
    const pair = sql.slice(i, i + 2)
    if (/\s/.test(sql[i])) {
      i++
      continue
    }
    if (pair === '--') {
      while (i < sql.length && !/[\r\n]/.test(sql[i])) i++
      continue
    }
    if (pair === '/*') {
      const end = sql.indexOf('*/', i + 2)
      if (strict && end < 0) throw new Error(incompleteSQL)
      i = end < 0 ? sql.length : end + 2
      continue
    }
    const quote = sql[i]
    if (quote === "'" || quote === '"') {
      i++
      let text = ''
      let closed = false
      while (i < sql.length) {
        const char = sql[i++]
        if (char === quote) {
          if (sql[i] !== quote) {
            closed = true
            break
          }
          i++
        }
        text += char
      }
      if (strict && !closed) throw new Error(incompleteSQL)
      yield { kind: quote === '"' ? 'identifier' : 'literal', text, start, end: i }
      continue
    }
    if (isWord.test(quote)) {
      while (i < sql.length && isWord.test(sql[i])) i++
      const text = sql.slice(start, i).toUpperCase()
      if ((text === 'Q' || text === 'NQ') && sql[i] === "'" && i + 1 < sql.length) {
        const opening = String.fromCodePoint(sql.codePointAt(i + 1)!)
        const closing = alternativeDelimiters[opening] ?? opening
        const end = sql.indexOf(closing + "'", i + 1 + opening.length)
        if (strict && end < 0) throw new Error(incompleteSQL)
        i = end < 0 ? sql.length : end + closing.length + 1
        yield { kind: 'literal', text: sql.slice(start, i), start, end: i }
      } else yield { kind: 'word', text, start, end: i }
      continue
    }
    i++
    yield { kind: 'symbol', text: quote, start, end: i }
  }
}

function procedural(words: readonly string[]) {
  if (words[0] === 'BEGIN' || words[0] === 'DECLARE') return true
  if (words[0] !== 'CREATE') return false
  let index = words[1] === 'OR' && words[2] === 'REPLACE' ? 3 : 1
  if (words[index] === 'EDITIONABLE' || words[index] === 'NONEDITIONABLE') index++
  return ['FUNCTION', 'PROCEDURE', 'PACKAGE', 'TRIGGER', 'TYPE'].includes(words[index])
}

export function splitOracleStatements(sql: string): string[] {
  const statements: string[] = []
  const words: string[] = []
  let start = 0
  let hasToken = false
  function emit(end: number, next: number) {
    if (hasToken) statements.push(sql.slice(start, end).trim())
    start = next
    words.length = 0
    hasToken = false
  }
  for (const token of oracleTokens(sql, true)) {
    if (token.kind === 'symbol' && token.text === '/' && isSlashLine(sql, token.start)) {
      emit(token.start, token.end)
    } else if (token.kind === 'symbol' && token.text === ';' && !procedural(words)) {
      emit(token.start, token.end)
    } else {
      hasToken = true
      if (words.length < 6) words.push(token.kind === 'word' ? token.text : '')
    }
  }
  emit(sql.length, sql.length)
  return statements
}

function isSlashLine(sql: string, index: number) {
  const start = Math.max(sql.lastIndexOf('\n', index), sql.lastIndexOf('\r', index)) + 1
  const lineEnd = /[\r\n]/.exec(sql.slice(index + 1))
  const end = lineEnd ? index + 1 + lineEnd.index : sql.length
  return !sql.slice(start, index).trim() && !sql.slice(index + 1, end).trim()
}

export function cleanOracleHistory(sql: string) {
  const statement = sql.trim()
  if (!statement) return ''
  const words: string[] = []
  for (const token of oracleTokens(statement)) {
    words.push(token.kind === 'word' ? token.text : '')
    if (words.length === 6) break
  }
  if (procedural(words)) return statement.endsWith('/') ? statement : statement + '\n/'
  return statement.endsWith(';') ? statement : statement + '\n;'
}
