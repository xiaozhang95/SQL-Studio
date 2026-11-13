import { Form } from 'antd'
import { useRef, useState } from 'react'

import { connectionGroupName, defaultConnectionGroup } from '@/constant/connectionGroup'
import { createConnectionGroup, deleteConnectionGroup, moveConnectionGroup, renameConnectionGroup } from '@/services/database'
import type { Connection } from '@/typings/database'

type Options = {
  groups: string[]
  blocked: boolean
  onGroupsChanged: (groups: string[]) => void
  onRenamed: (name: string, newName: string) => void
  onDeleted: (name: string) => void
  onMoved: (connection: Connection) => void
}

/** 只保存分组元数据；不打开、关闭或重建数据库会话。 */
export function useConnectionGroups({ groups, blocked, onGroupsChanged, onRenamed, onDeleted, onMoved }: Options) {
  const [form] = Form.useForm<{ name: string }>()
  const [dialog, setDialog] = useState<{ original?: string; deleting?: boolean }>()
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [moveError, setMoveError] = useState('')
  const pending = useRef(false)

  function open(original?: string, deleting = false) {
    if (blocked || pending.current || dialog || original === defaultConnectionGroup) return
    setError('')
    setDialog({ original, deleting })
    setVisible(true)
    form.setFieldsValue({ name: original || '' })
  }
  function close() {
    if (!pending.current) setVisible(false)
  }
  async function save() {
    if (!dialog || !visible || pending.current || blocked) return
    pending.current = true
    try {
      const { name: value } = await form.validateFields()
      const name = value.trim()
      setSaving(true)
      setError('')
      if (dialog.deleting && dialog.original) {
        const state = await deleteConnectionGroup(dialog.original)
        onGroupsChanged(state.groups)
        onDeleted(dialog.original)
      } else if (dialog.original) {
        const state = await renameConnectionGroup(dialog.original, name)
        onGroupsChanged(state.groups)
        onRenamed(dialog.original, name)
      } else onGroupsChanged(await createConnectionGroup(name))
      setVisible(false)
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
    setMoveError('')
    try {
      onMoved(await moveConnectionGroup(connection.id, group))
    } catch (cause) {
      setMoveError(cause instanceof Error ? cause.message : '移动分组失败，请重试')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return {
    groups,
    form,
    dialog,
    visible,
    afterClose: () => setDialog(undefined),
    saving,
    error,
    moveError,
    clearMoveError: () => setMoveError(''),
    blocked,
    open,
    remove: (name: string) => open(name, true),
    close,
    save,
    move
  }
}
