import { App, Form } from 'antd'
import { useEffect, useState } from 'react'

import { connectionGroupName, databaseTypeInfo, defaultConnectionGroup } from '@/constant/database'
import { saveConnection, testConnection } from '@/services/database'
import type { Connection, ConnectionInput } from '@/typings/database'

type Props = { open: boolean; connection?: Connection; connections: Connection[]; onSaved: (connection: Connection) => void }
type TestStatus = { type: 'success' | 'error'; message: string }
/** 表单不回显已保存密码；空密码由后端按连接 ID 保留原凭据。 */
export const useConnectionForm = ({ open, connection, connections, onSaved }: Props) => {
  const [form] = Form.useForm<ConnectionInput>()
  const { message } = App.useApp()
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<TestStatus>()
  const [section, setSection] = useState('general')
  const engine = databaseTypeInfo(Form.useWatch('type', form) || connection?.type)
  const busy = saving || testing
  const groups = [
    defaultConnectionGroup,
    ...[...new Set(connections.map((item) => connectionGroupName(item.group)))].filter((group) => group !== defaultConnectionGroup).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  ]
  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue(
        connection
          ? {
              ...connection,
              group: connectionGroupName(connection.group),
              type: connection.type || 'mysql',
              tls: connection.tls || false,
              password: ''
            }
          : { type: 'mysql', tls: false, name: '', group: defaultConnectionGroup, host: '', port: 3306, username: '' }
      )
    }
  }, [open, connection, form])
  async function values() {
    try {
      const value = await form.validateFields()
      return { ...value, group: connectionGroupName(value.group), id: connection?.id }
    } catch (error) {
      setSection('general')
      throw error
    }
  }
  async function test() {
    try {
      const value = await values()
      setTesting(true)
      setStatus(undefined)
      const result = await testConnection(value)
      setStatus({ type: 'success', message: result.version })
    } catch (error) {
      if (error instanceof Error) setStatus({ type: 'error', message: error.message })
    } finally {
      setTesting(false)
    }
  }
  async function save() {
    try {
      const value = await values()
      setSaving(true)
      const result = await saveConnection(value)
      message.success('连接已保存')
      onSaved(result)
    } catch (error) {
      if (error instanceof Error) setStatus({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  return { form, groups, saving, testing, status, section, engine, busy, setStatus, setSection, test, save }
}
