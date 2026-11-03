import { Alert, App, Descriptions, Flex } from 'antd'
import { useEffect, useRef } from 'react'

import { isObject } from '../../../../utils/json'
import { CodeBlock } from '../../components/codeBlock'

export function useWriteConfirmation() {
  const { modal } = App.useApp()
  const close = useRef<(() => void) | null>(null)
  useEffect(() => () => close.current?.(), [])
  function show(value: unknown, signal: AbortSignal) {
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
    if (signal.aborted) return
    const id = value.approvalId
    const details = (
      <Flex vertical gap="small">
        <Alert type="warning" showIcon title="将实际修改数据库，操作可能不可撤销；请核对库、表和SQL。" />
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'connection', label: '连接', children: value.connection },
            { key: 'database', label: '数据库', children: value.database },
            { key: 'objects', label: '涉及表／对象', children: value.objects.length ? value.objects.join('、') : '请核对下方SQL中的对象' }
          ]}
        />
        <CodeBlock language="sql" text={value.sql} />
      </Flex>
    )
    let settled = false
    async function decide(allow: boolean) {
      if (settled) return
      const response = await fetch('/api/agent/write-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvalId: id, allow }), signal })
      if (!response.ok) {
        const data: unknown = await response.json()
        const reason = isObject(data) && typeof data.error === 'string' ? data.error : '操作确认失败'
        dialog.update({
          content: (
            <Flex vertical gap="small">
              {details}
              <Alert type="error" title={reason} />
            </Flex>
          )
        })
        throw new Error(reason)
      }
      settled = true
      signal.removeEventListener('abort', abort)
      close.current = null
    }
    const dialog = modal.confirm({
      title: '确认执行数据库操作',
      width: 760,
      content: details,
      okText: '确认执行',
      cancelText: '取消执行',
      mask: { closable: false },
      keyboard: false,
      onOk: () => decide(true),
      onCancel: () => decide(false)
    })
    function abort() {
      settled = true
      dialog.destroy()
      close.current = null
      signal.removeEventListener('abort', abort)
    }
    close.current = abort
    signal.addEventListener('abort', abort, { once: true })
  }
  return { show, close: () => close.current?.() }
}
