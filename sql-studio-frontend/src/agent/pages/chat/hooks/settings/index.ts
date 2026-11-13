import { useEffect, useState } from 'react'

import { observeSettings, settings } from '../../../../services/settings'
import type { AIStatus } from '../../../../typings/settings'

export function useAISettings() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => observeSettings(setStatus, () => setStatus(null)), [])
  async function chooseModel(model: string) {
    if (busy || !status?.models.some((entry) => entry.id === model)) return
    setBusy(true)
    try {
      const next = await settings('PUT', { configId: model })
      setStatus(next)
      window.dispatchEvent(new Event('ai-settings-saved'))
    } catch {
      window.dispatchEvent(new Event('ai-settings-saved'))
    } finally {
      setBusy(false)
    }
  }
  return { status, busy, chooseModel }
}
