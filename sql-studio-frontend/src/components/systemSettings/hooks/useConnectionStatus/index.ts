import { useCallback, useEffect, useRef, useState } from 'react'

import { getAIAdapter } from '@/ai'
import type { AIConfigDocument } from '@/ai/typings'
import { request } from '@/utils/request'

type ConnectionStatus = 'checking' | 'unconfigured' | 'connected' | 'failed'

const statusTtlMs = 60_000
const retryDelayMs = 10_000

export function useConnectionStatus(open: boolean) {
  const [status, setStatus] = useState<ConnectionStatus>('checking')
  const pending = useRef<AbortController | null>(null)
  const expiresAt = useRef(0)

  const check = useCallback(async () => {
    if (pending.current || performance.now() < expiresAt.current) return
    const controller = new AbortController()
    const { signal } = controller
    pending.current = controller
    setStatus('checking')

    let result: Exclude<ConnectionStatus, 'checking'> = 'unconfigured'
    try {
      const config = await request<AIConfigDocument>('/state/ai', { signal })
      if (signal.aborted) return
      if (config.data?.configured) {
        await getAIAdapter().listModels('', signal)
        result = 'connected'
      }
    } catch {
      result = 'failed'
    } finally {
      if (pending.current === controller) pending.current = null
    }
    if (signal.aborted) return
    expiresAt.current = performance.now() + (result === 'failed' ? retryDelayMs : statusTtlMs)
    setStatus(result)
  }, [])

  useEffect(() => {
    const invalidate = () => {
      pending.current?.abort()
      pending.current = null
      expiresAt.current = 0
      if (open) void check()
    }
    window.addEventListener('ai-settings-saved', invalidate)
    return () => window.removeEventListener('ai-settings-saved', invalidate)
  }, [open, check])

  useEffect(
    () => () => {
      pending.current?.abort()
      pending.current = null
    },
    []
  )

  return { status, check }
}
