import { App, Upload } from 'antd'
import { useState } from 'react'

const maxSQLFileBytes = 16 * 1024 * 1024

/** 文件只载入新查询，不上传服务器或自动执行。 */
export const useSQLImport = (onImport: (sql: string, title: string) => void) => {
  const { message } = App.useApp()
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const beforeImport = async (file: File) => {
    setImporting(true)
    setError('')
    try {
      if (!file.name.toLowerCase().endsWith('.sql')) throw new Error('请选择 .sql 文件')
      if (file.size > maxSQLFileBytes) throw new Error('SQL 文件不能超过 16 MiB')
      let sql: string
      try {
        sql = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '')
      } catch {
        throw new Error('请使用 UTF-8 编码的 SQL 文件')
      }
      if (!sql.trim()) throw new Error('SQL 文件内容为空')
      onImport(sql, file.name)
      message.success('SQL 已导入新查询')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'SQL 文件读取失败')
    } finally {
      setImporting(false)
    }
    return Upload.LIST_IGNORE
  }
  return { beforeImport, importing, error, clearError: () => setError('') }
}
