import { useEffect, useRef, useState } from 'react'

import type { WriteConfirmationRequest } from '../../../../typings/writeConfirmation'
import { isObject } from '../../../../utils/json'

interface PendingRequest {
  value: WriteConfirmationRequest
  signal: AbortSignal
  abort: () => void
  submitting: boolean
}

export function useWriteConfirmation() {
  const [pending, setPending] = useState<WriteConfirmationRequest | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<PendingRequest | null>(null)

  function release() {
    const request = active.current
    active.current = null
    if (request) request.signal.removeEventListener('abort', request.abort)
  }
  useEffect(() => release, [])

  function close() {
    release()
    setPending(null)
    setSubmitting(false)
    setError('')
  }

  function show(value: unknown, signal: AbortSignal) {
    if (
      !isObject(value) ||
      typeof value.approvalId !== 'string' ||
      typeof value.sql !== 'string' ||
      typeof value.database !== 'string' ||
      typeof value.connection !== 'string' ||
      !Array.isArray(value.objects) ||
      !value.objects.every((v) => typeof v === 'string')
    )
      throw new Error('写入确认信息无效')
    close()
    if (signal.aborted) return
    const request: PendingRequest = {
      value: { approvalId: value.approvalId, sql: value.sql, database: value.database, connection: value.connection, objects: [...value.objects] },
      signal,
      submitting: false,
      abort: () => {
        if (active.current === request) close()
      }
    }
    active.current = request
    signal.addEventListener('abort', request.abort, { once: true })
    setPending(request.value)
  }

  async function decide(allow: boolean) {
    const request = active.current
    if (!request || request.submitting || request.signal.aborted) return
    request.submitting = true
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/agent/write-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: request.value.approvalId, allow }),
        signal: request.signal
      })
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null)
        throw new Error(isObject(data) && typeof data.error === 'string' ? data.error : '操作确认失败')
      }
      if (active.current === request && !request.signal.aborted) close()
    } catch (cause) {
      if (active.current !== request || request.signal.aborted) return
      request.submitting = false
      setSubmitting(false)
      setError(cause instanceof Error ? cause.message : '操作确认失败')
    }
  }

  return { pending, submitting, error, show, decide, close }
}
