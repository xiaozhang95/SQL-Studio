import type { CompletionContext } from '@codemirror/autocomplete'

// Common redis-cli commands with their arguments. Keep variants on the wire as typed.
const redisCommandSignatures = [
  'APPEND key value',
  'COPY source destination [DB db]',
  'DBSIZE',
  'DECR key',
  'DECRBY key decrement',
  'DEL key [key ...]',
  'ECHO message',
  'EXISTS key [key ...]',
  'EXPIRE key seconds',
  'EXPIREAT key timestamp',
  'GET key',
  'GETDEL key',
  'GETEX key [EX seconds]',
  'GETRANGE key start end',
  'HDEL key field [field ...]',
  'HEXISTS key field',
  'HGET key field',
  'HGETALL key',
  'HINCRBY key field increment',
  'HKEYS key',
  'HLEN key',
  'HMGET key field [field ...]',
  'HSCAN key cursor [MATCH pattern] [COUNT count]',
  'HSET key field value',
  'HSETNX key field value',
  'HVALS key',
  'INCR key',
  'INCRBY key increment',
  'INFO [section]',
  'LINDEX key index',
  'LLEN key',
  'LPOP key [count]',
  'LPUSH key element [element ...]',
  'LRANGE key start stop',
  'LREM key count element',
  'LSET key index element',
  'LTRIM key start stop',
  'MGET key [key ...]',
  'MSET key value [key value ...]',
  'PERSIST key',
  'PEXPIRE key milliseconds',
  'PING [message]',
  'PTTL key',
  'PUBLISH channel message',
  'PUBSUB CHANNELS [pattern]',
  'RANDOMKEY',
  'RENAME key newkey',
  'RENAMENX key newkey',
  'RPOP key [count]',
  'RPUSH key element [element ...]',
  'SADD key member [member ...]',
  'SCAN cursor [MATCH pattern] [COUNT count]',
  'SCARD key',
  'SELECT index',
  'SET key value [EX seconds] [PX milliseconds] [NX | XX]',
  'SETNX key value',
  'SETRANGE key offset value',
  'SISMEMBER key member',
  'SMEMBERS key',
  'SPOP key [count]',
  'SREM key member [member ...]',
  'SSCAN key cursor [MATCH pattern] [COUNT count]',
  'STRLEN key',
  'TIME',
  'TTL key',
  'TYPE key',
  'UNLINK key [key ...]',
  'XADD key * field value',
  'XDEL key id [id ...]',
  'XLEN key',
  'XRANGE key start end [COUNT count]',
  'XREVRANGE key end start [COUNT count]',
  'ZADD key score member',
  'ZCARD key',
  'ZCOUNT key min max',
  'ZINCRBY key increment member',
  'ZRANGE key start stop [WITHSCORES]',
  'ZREM key member [member ...]',
  'ZSCAN key cursor [MATCH pattern] [COUNT count]',
  'ZSCORE key member'
]
const commands = redisCommandSignatures.map((usage) => {
  const [label, ...args] = usage.split(' ')
  return { label, detail: args.join(' '), type: 'keyword' }
})

export function redisCommandHints(input: string): string[] {
  const match = /^[\t ]*([\w.-]+)([\t ;]|$)/.exec(input)
  if (!match) return []
  const name = match[1].toUpperCase()
  const exact = commands.find((command) => command.label === name)
  if (exact) return [exact.detail ? `${exact.label} ${exact.detail}` : exact.label]
  return match[2]
    ? []
    : commands
        .filter((command) => command.label.startsWith(name))
        .slice(0, 5)
        .map((command) => command.label)
}

export function formatRedisCommands(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/^([\t ]*)([A-Za-z][\w.-]*)(?=[\t ;\r]|$)([\t ]*)/, (_, indent: string, command: string, gap: string) => indent + command.toUpperCase() + (gap ? ' ' : '')))
    .join('\n')
}

export function redisCompletion(context: CompletionContext) {
  const prefix = context.matchBefore(/^[\t ]*[a-zA-Z][a-zA-Z0-9_.-]*$/)
  if (prefix) return { from: prefix.from + prefix.text.search(/\S/), options: commands, validFor: /^[\w.-]*$/ }
  const line = context.state.doc.lineAt(context.pos)
  if (context.explicit && !context.state.sliceDoc(line.from, context.pos).trim()) return { from: context.pos, options: commands }
  return null
}

export function splitRedisLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(withoutStatementTerminator)
    .filter(Boolean)
}

function withoutStatementTerminator(line: string) {
  if (!line.endsWith(';')) return line
  let quote = ''
  for (let index = 0; index < line.length - 1; index++) {
    const character = line[index]
    if (quote) {
      if (character === quote) quote = ''
      else if (character === '\\' && (quote === '"' || line[index + 1] === "'")) index++
    } else if (character === '"' || character === "'") quote = character
  }
  return quote ? line : line.slice(0, -1).trimEnd()
}
