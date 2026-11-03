import { useEffect, useState } from 'react'

import { observeSettings, settings } from '../../../../services/settings'
import type { AIStatus } from '../../../../typings/settings'

export function useAISettings() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(
    () =>
      observeSettings(
        (value) => {
          setStatus(value)
          setError('')
        },
        (cause) => setError(cause.message)
      ),
    []
  )
  async function chooseModel(model: string) {
    if (busy || !status?.configured) return
    setBusy(true)
    setError('')
    try {
      const next = await settings('PUT', { apiKey: '', model })
      setStatus(next)
      setNotice('模型已更新，共用工作区的 API Key。')
      window.dispatchEvent(new Event('ai-settings-saved'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '模型保存失败')
    } finally {
      setBusy(false)
    }
  }
  return { status, busy, error, notice, chooseModel, dismissNotice: () => setNotice('') }
}
