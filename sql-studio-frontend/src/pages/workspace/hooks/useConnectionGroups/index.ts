import { App, Form } from 'antd'
import { useRef, useState } from 'react'

import { connectionGroupName, defaultConnectionGroup } from '@/constant/connectionGroup'
import { createConnectionGroup, moveConnectionGroup, renameConnectionGroup } from '@/services/database'
import type { Connection } from '@/typings/database'

type Options = {
  groups: string[]
  blocked: boolean
  onGroupsChanged: (groups: string[]) => void
  onRenamed: (name: string, newName: string) => void
  onMoved: (connection: Connection) => void
}

/** 只保存分组元数据；不打开、关闭或重建数据库会话。 */
export function useConnectionGroups({ groups, blocked, onGroupsChanged, onRenamed, onMoved }: Options) {
  const { modal } = App.useApp()
  const [form] = Form.useForm<{ name: string }>()
  const [dialog, setDialog] = useState<{ original?: string }>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  function open(original?: string) {
    if (blocked || pending.current || dialog || original === defaultConnectionGroup) return
    setError('')
    setDialog({ original })
    form.setFieldsValue({ name: original || '' })
  }
  function close() {
    if (!pending.current) setDialog(undefined)
  }
  async function save() {
    if (!dialog || pending.current || blocked) return
    pending.current = true
    try {
      const { name: value } = await form.validateFields()
      const name = value.trim()
      setSaving(true)
      setError('')
      if (dialog.original) {
        const state = await renameConnectionGroup(dialog.original, name)
        onGroupsChanged(state.groups)
        onRenamed(dialog.original, name)
      } else onGroupsChanged(await createConnectionGroup(name))
      setDialog(undefined)
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message)
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  async function move(connection: Connection, group: string) {
    if (blocked || pending.current || dialog || connectionGroupName(connection.group) === group) return
    pending.current = true
    setSaving(true)
    try {
      onMoved(await moveConnectionGroup(connection.id, group))
    } catch (cause) {
      modal.error({ title: '移动分组失败', content: cause instanceof Error ? cause.message : '请重试' })
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return { groups, form, dialog, saving, error, blocked, open, close, save, move }
}
