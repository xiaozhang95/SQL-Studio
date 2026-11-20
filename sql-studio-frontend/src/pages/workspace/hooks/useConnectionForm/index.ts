import { App, Form } from 'antd'
import { useEffect, useState } from 'react'

import { connectionGroupName, defaultConnectionGroup } from '@/constant/connectionGroup'
import { getDatabaseProfile } from '@/databases'
import { DatabaseEngine } from '@/databases/typings'
import type { DatabaseType } from '@/databases/typings'
import { saveConnection, testConnection } from '@/services/database'
import type { Connection, ConnectionInput, RedisConnectionMode } from '@/typings/database'

type Props = { open: boolean; connection?: Connection; groups: string[]; onSaved: (connection: Connection) => void }
type TestStatus = { type: 'success' | 'error'; message: string }
type FormValues = Omit<ConnectionInput, 'redisNodes'> & { redisNodesText?: string }
/** 表单不回显已保存密码；空密码由后端按连接 ID 保留原凭据。 */
export const useConnectionForm = ({ open, connection, groups, onSaved }: Props) => {
  const [form] = Form.useForm<FormValues>()
  const { message } = App.useApp()
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<TestStatus>()
  const [section, setSection] = useState('general')
  const engine = getDatabaseProfile(Form.useWatch('type', form) || connection?.type)
  const redisMode: RedisConnectionMode = Form.useWatch('redisMode', form) || 'standalone'
  const busy = saving || testing
  useEffect(() => {
    if (open) {
      const initialEngine = getDatabaseProfile(connection?.type)
      form.resetFields()
      form.setFieldsValue(
        connection
          ? {
              ...connection,
              group: connectionGroupName(connection.group),
              type: connection.type || initialEngine.value,
              database: connection.database || initialEngine.database,
              tls: connection.tls || false,
              password: '',
              redisMode: connection.redisMode || 'standalone',
              redisNodesText: connection.redisNodes?.join('\n'),
              redisSentinelPassword: ''
            }
          : {
              type: initialEngine.value,
              tls: false,
              name: '',
              group: defaultConnectionGroup,
              host: '',
              port: initialEngine.port,
              database: initialEngine.database,
              username: '',
              redisMode: 'standalone'
            }
      )
    }
  }, [open, connection, form])
  function selectEngine(type: DatabaseType) {
    if (busy || connection || type === engine.value) return
    const profile = getDatabaseProfile(type)
    const current = form.getFieldsValue(true)
    // 重置字段生命周期以取消旧引擎校验，再恢复共用输入和新引擎默认值。
    form.resetFields()
    form.setFieldsValue({ ...current, type, port: profile.port, database: profile.database, redisMode: 'standalone' })
    setStatus(undefined)
  }
  function selectRedisMode(next: RedisConnectionMode) {
    const port = form.getFieldValue('port')
    if (next === 'sentinel' && port === 6379) form.setFieldValue('port', 26379)
    if (redisMode === 'sentinel' && next !== 'sentinel' && port === 26379) form.setFieldValue('port', 6379)
    setStatus(undefined)
  }
  async function values(): Promise<ConnectionInput> {
    try {
      const { redisMode = 'standalone', redisNodesText, redisMasterName, redisSentinelUsername, redisSentinelPassword, ...value } = await form.validateFields()
      const redis = value.type === DatabaseEngine.Redis
      const nodes = redisNodesText
        ?.split(/[\r\n,]+/)
        .map((address) => address.trim())
        .filter(Boolean)
      return {
        ...value,
        ...(redis ? { redisMode, database: redisMode === 'cluster' ? '0' : connection?.database || engine.database } : {}),
        ...(redis && redisMode !== 'standalone' ? { redisNodes: nodes } : {}),
        ...(redis && redisMode === 'sentinel' ? { redisMasterName, redisSentinelUsername, redisSentinelPassword } : {}),
        group: connectionGroupName(value.group),
        id: connection?.id
      }
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

  return { form, selectEngine, selectRedisMode, redisMode, groups, saving, testing, status, section, engine, busy, setStatus, setSection, test, save }
}
