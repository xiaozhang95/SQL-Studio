import { Form } from 'antd'
import { useState } from 'react'

import type { ConversationInfo } from '../../../../typings/workspace'

export function useSessionRename(onRename: (id: string, title: string) => Promise<void>) {
  const [selected, setSelected] = useState<ConversationInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form] = Form.useForm<{ title: string }>()
  function show(item: ConversationInfo) {
    setSelected(item)
    setError('')
    form.setFieldsValue({ title: item.title })
  }
  function close() {
    if (!busy) {
      setSelected(null)
      form.resetFields()
      setError('')
    }
  }
  async function save({ title }: { title: string }) {
    if (!selected || busy) return
    setBusy(true)
    setError('')
    try {
      await onRename(selected.id, title.trim())
      setSelected(null)
      form.resetFields()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重命名失败')
    } finally {
      setBusy(false)
    }
  }
  return { selected, busy, error, form, show, close, save }
}
