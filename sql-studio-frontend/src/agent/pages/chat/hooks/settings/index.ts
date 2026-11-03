import { Form } from 'antd'
import { useEffect, useState } from 'react'

import { settings } from '../../../../services/settings'
import type { AIStatus, AIUpdate } from '../../../../typings/settings'

export function useAISettings() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form] = Form.useForm<AIUpdate>()
  useEffect(() => {
    const c = new AbortController()
    settings('GET', undefined, c.signal)
      .then((v) => {
        if (!c.signal.aborted) setStatus(v)
      })
      .catch((e: Error) => {
        if (!c.signal.aborted) setError(e.message)
      })
    return () => c.abort()
  }, [])
  function show() {
    setNotice('')
    setOpen(true)
    form.resetFields()
    form.setFieldsValue({
      apiKey: '',
      model: status?.model
    })
  }
  function close() {
    if (busy) return
    form.resetFields()
    setOpen(false)
  }
  async function save(input: AIUpdate) {
    setBusy(true)
    setError('')
    try {
      const value = await settings('PUT', input)
      setStatus(value)
      window.dispatchEvent(new Event('ai-settings-saved'))
      form.resetFields()
      setOpen(false)
      setNotice('DeepSeek 设置已保存。')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }
  async function chooseModel(model: string) {
    if (busy || !status?.configured) return
    await save({ apiKey: '', model })
  }
  async function clear() {
    setBusy(true)
    setError('')
    try {
      const value = await settings('DELETE')
      window.dispatchEvent(new Event('ai-settings-saved'))
      setStatus(value)
      form.resetFields()
      form.setFieldsValue({ apiKey: '', model: value.model })
      setNotice('已清除 API Key。')
    } catch (e) {
      setError(e instanceof Error ? e.message : '清除失败')
    } finally {
      setBusy(false)
    }
  }
  return {
    status,
    open,
    busy,
    error,
    notice,
    form,
    show,
    close,
    save,
    clear,
    chooseModel,
    dismissNotice: () => setNotice('')
  }
}
