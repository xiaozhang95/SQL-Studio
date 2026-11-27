const modeCommand = /^(?:SET|RESET|BEGIN|START|COMMIT|END|ABORT|ROLLBACK|SAVEPOINT|RELEASE)\b/i
const setStrings = /^SET\s+(?:(SESSION|LOCAL)\s+)?standard_conforming_strings\s*(?:=\s*|TO\s+)(['"]?)(on|off|true|false|yes|no|1|0|default)\2$/i
const resetStrings = /^RESET\s+(?:standard_conforming_strings|ALL)$/i
const endTransaction = /^(COMMIT|END|ROLLBACK|ABORT)(?:\s+(?:WORK|TRANSACTION))?(?:\s+AND\s+(NO\s+)?(CHAIN))?$/i
const savepointCommand = /^(SAVEPOINT|RELEASE(?:\s+SAVEPOINT)?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?\s+TO(?:\s+SAVEPOINT)?)\s+("(?:[^"]|"")+"|[\p{L}_][\p{L}\p{N}_$]*)$/iu

function createStringMode() {
  // Every batch opens with standard_conforming_strings=on.
  let session = true
  let current = session
  let transactionStart: boolean | undefined
  const savepoints: { name: string; session: boolean; current: boolean }[] = []

  return {
    get backslashEscapes() {
      return !current
    },
    apply(command: string) {
      const setting = setStrings.exec(command)
      if (setting || resetStrings.test(command)) {
        const local = setting?.[1]?.toUpperCase() === 'LOCAL'
        if (local && transactionStart === undefined) return
        current = !/^(?:off|false|no|0)$/i.test(setting?.[3] ?? 'default')
        if (!local) session = current
        return
      }
      if (/^(?:BEGIN|START\s+TRANSACTION)\b/i.test(command)) {
        transactionStart ??= session
        return
      }
      if (transactionStart === undefined) return
      const end = endTransaction.exec(command)
      if (end) {
        if (/^(?:ROLLBACK|ABORT)$/i.test(end[1])) session = transactionStart
        current = session
        transactionStart = end[3] && !end[2] ? session : undefined
        savepoints.length = 0
        return
      }
      const savepoint = savepointCommand.exec(command)
      if (!savepoint) return
      const [, action, identifier] = savepoint
      const name = identifier.startsWith('"') ? identifier.slice(1, -1).replace(/""/g, '"') : identifier.toLowerCase()
      if (action.toUpperCase() === 'SAVEPOINT') {
        savepoints.push({ name, session, current })
        return
      }
      const index = savepoints.findLastIndex((entry) => entry.name === name)
      if (index < 0) return
      if (/^ROLLBACK\b/i.test(action)) {
        session = savepoints[index].session
        current = savepoints[index].current
        savepoints.length = index + 1
      } else savepoints.length = index
    }
  }
}

/** PostgreSQL lexical boundaries: dollar quotes, E strings and nested block comments. */
function scan(script: string, removeMarkers: boolean) {
  const statements: string[] = []
  const mode = createStringMode()
  const commandParts: string[] = []
  let output = '',
    outputStart = 0,
    start = 0,
    commandStart = -1,
    quote = '',
    dollar = '',
    block = 0,
    line = false,
    escaped = false,
    hasSQL = false
  const append = (end: number, terminated = false) => {
    if (hasSQL && !removeMarkers) statements.push(script.slice(start, end).trim())
    if (terminated && commandStart >= 0) {
      commandParts.push(script.slice(commandStart, end - 1))
      mode.apply(commandParts.join(' ').trim())
    }
    commandParts.length = 0
    commandStart = -1
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
      if (char === '\n' || char === '\r') {
        line = false
        if (commandStart >= 0) commandStart = i + 1
      }
      continue
    }
    if (block) {
      if (char === '/' && next === '*') {
        block++
        i++
      } else if (char === '*' && next === '/') {
        block--
        i++
        if (!block && commandStart >= 0) commandStart = i + 1
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
        output += script.slice(outputStart, i)
        if (commandStart >= 0) commandParts.push(script.slice(commandStart, i))
        i += marker[0].length - 1
        outputStart = i + 1
        if (commandStart >= 0) commandStart = i + 1
        continue
      }
    }
    if ((char === '-' && next === '-') || (char === '/' && next === '*')) {
      if (commandStart >= 0) commandParts.push(script.slice(commandStart, i))
      if (char === '-') line = true
      else block = 1
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
      escaped = char === "'" && (mode.backslashEscapes || (/e/i.test(script[i - 1] || '') && (i < 2 || !/[\p{L}\p{N}_$]/u.test(script[i - 2]))))
      hasSQL = true
    } else if (char === ';') append(i + 1, true)
    else if (!/\s/.test(char)) {
      if (!hasSQL && modeCommand.test(script.slice(i, i + 12))) commandStart = i
      hasSQL = true
    }
  }
  if (!removeMarkers && (quote || dollar || block)) throw new Error('SQL 包含未闭合的引号、美元引号或注释')
  if (removeMarkers) return { statements, cleaned: (output + script.slice(outputStart)).trim() }
  append(script.length)
  return { statements, cleaned: script.trim() }
}
export const splitPostgreSQLStatements = (script: string) => scan(script, false).statements
export const cleanPostgreSQLHistory = (script: string) => scan(script, true).cleaned
