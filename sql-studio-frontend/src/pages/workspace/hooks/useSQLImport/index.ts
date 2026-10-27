import { App, Upload } from 'antd'
import { useState } from 'react'

/** 文件只载入新查询，不上传服务器或自动执行；限制与后端请求大小一致。 */
export const useSQLImport = (onImport: (sql: string, title: string) => void) => {
  const { message } = App.useApp()
  const [importing, setImporting] = useState(false)
  const beforeImport = async (file: File) => {
    setImporting(true)
    try {
      if (!file.name.toLowerCase().endsWith('.sql')) throw new Error('请选择 .sql 文件')
      if (file.size > 1024 * 1024) throw new Error('SQL 文件不能超过 1 MiB')
      let sql: string
      try {
        sql = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '')
      } catch {
        throw new Error('请使用 UTF-8 编码的 SQL 文件')
      }
      if (!sql.trim()) throw new Error('SQL 文件内容为空')
      if (new TextEncoder().encode(JSON.stringify({ sql })).length > 1024 * 1024 - 4096) throw new Error('SQL 内容编码后超过请求大小限制')
      onImport(sql, file.name)
      message.success('SQL 已导入新查询')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'SQL 文件读取失败')
    } finally {
      setImporting(false)
    }
    return Upload.LIST_IGNORE
  }
  return { beforeImport, importing }
}
