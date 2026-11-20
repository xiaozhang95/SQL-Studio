import { useEffect, useState } from 'react'

import { observeSettings, settings } from '../../../../services/settings'
import type { AIStatus } from '../../../../typings/settings'

export function useAISettings() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [readError, setReadError] = useState('')
  const [choiceError, setChoiceError] = useState('')
  const [readAttempt, setReadAttempt] = useState(0)
  useEffect(
    () =>
      observeSettings(
        (next) => {
          setStatus(next)
          setReadError('')
          setLoading(false)
        },
        (error) => {
          setStatus(null)
          setReadError(error.message)
          setLoading(false)
        }
      ),
    [readAttempt]
  )
  function retry() {
    setLoading(true)
    setReadError('')
    setReadAttempt((value) => value + 1)
  }
  async function chooseModel(model: string) {
    if (busy || !status?.models.some((entry) => entry.id === model)) return
    setBusy(true)
    setChoiceError('')
    try {
      const next = await settings('PUT', { configId: model })
      setStatus(next)
      window.dispatchEvent(new Event('ai-settings-saved'))
    } catch (error) {
      setChoiceError(error instanceof Error ? error.message : '切换模型失败')
      window.dispatchEvent(new Event('ai-settings-saved'))
    } finally {
      setBusy(false)
    }
  }
  return { status, busy: busy || loading, loading, readError, choiceError, chooseModel, retry }
}
