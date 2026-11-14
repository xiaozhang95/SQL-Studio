import { useEffect, useRef, useState } from 'react'

import { splitRedisLines } from '@/databases/redis/editor'
import { runCommand } from '@/services/redis'

type Result = { command: string; database: number; output: string; error?: boolean; truncated?: boolean }

export function useRedisExecution(id: string, onDatabase: (database: number) => void) {
  const [results, setResults] = useState<Result[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'finished' | 'failed' | 'cancelled'>('idle')
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  async function execute(text: string, database: number) {
    const commands = splitRedisLines(text)
    if (request.current || commands.length === 0) return
    const controller = new AbortController()
    request.current = controller
    setResults([])
    setStatus('running')
    let current = database
    try {
      for (const command of commands) {
        controller.signal.throwIfAborted()
        const result = await runCommand(id, current, command, controller.signal)
        controller.signal.throwIfAborted()
        const item: Result = { command, database: current, output: result.output, truncated: result.truncated }
        setResults((items) => [...items, item])
        if (result.database !== current) {
          current = result.database
          onDatabase(current)
        }
      }
      setStatus('finished')
    } catch (error) {
      if (!controller.signal.aborted) {
        const output = error instanceof Error ? error.message : String(error)
        setResults((items) => [...items, { command: commands[items.length], database: current, output, error: true }])
        setStatus('failed')
      }
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  function cancel() {
    request.current?.abort()
    request.current = null
    setStatus('cancelled')
  }

  return { results, status, execute, cancel }
}
