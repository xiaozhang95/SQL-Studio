import { useEffect, useRef, useState } from 'react'

import { request as sendRequest } from '@/utils/request'

import type { ConfirmationRequest } from '../../../../typings/writeConfirmation'
import { isObject } from '../../../../utils/json'

interface PendingRequest {
  value: ConfirmationRequest
  signal: AbortSignal
  abort: () => void
  submitting: boolean
}

export function useWriteConfirmation() {
  const [pending, setPending] = useState<ConfirmationRequest | null>(null)
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

  function show(value: unknown, signal: AbortSignal, continuation = false) {
    let confirmation: ConfirmationRequest
    if (continuation) {
      if (!isObject(value) || typeof value.approvalId !== 'string' || typeof value.detail !== 'string' || (value.kind !== 'input' && value.kind !== 'result' && value.kind !== 'context'))
        throw new Error('继续确认信息无效')
      confirmation = { approvalId: value.approvalId, kind: value.kind, detail: value.detail }
    } else {
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
      confirmation = { approvalId: value.approvalId, sql: value.sql, database: value.database, connection: value.connection, objects: [...value.objects] }
    }
    close()
    if (signal.aborted) return
    const request: PendingRequest = {
      value: confirmation,
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
    if (!request || request.submitting || request.signal.aborted) return false
    request.submitting = true
    setSubmitting(true)
    setError('')
    try {
      const endpoint = 'kind' in request.value ? '/agent/continue-confirmation' : '/agent/write-confirmation'
      await sendRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: request.value.approvalId, allow }),
        signal: request.signal
      })
      if (active.current === request && !request.signal.aborted) close()
      return !request.signal.aborted
    } catch (cause) {
      if (active.current !== request || request.signal.aborted) return false
      request.submitting = false
      setSubmitting(false)
      setError(cause instanceof Error ? cause.message : '操作确认失败')
      return false
    }
  }

  return { pending, submitting, error, show, decide, close }
}
