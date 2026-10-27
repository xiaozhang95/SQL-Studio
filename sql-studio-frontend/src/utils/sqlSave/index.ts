import { exportSQL } from '../sqlExport/index.ts'

type SavePicker = (options: {
  suggestedName: string
  types: { description: string; accept: Record<string, string[]> }[]
}) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> }>

/** 原生保存取消或写入失败时抛错，由调用者保留查询页；不支持时沿用下载导出。 */
export async function saveSQL(sql: string, title: string): Promise<void> {
  const target: Window & { showSaveFilePicker?: SavePicker } = window
  if (!target.showSaveFilePicker) {
    exportSQL(sql, title)
    return
  }
  const filename = Array.from(title, (char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char)).join('')
  const handle = await target.showSaveFilePicker({ suggestedName: filename + '.sql', types: [{ description: 'SQL 文件', accept: { 'text/plain': ['.sql'] } }] })
  const writer = await handle.createWritable()
  try {
    await writer.write(new Blob([sql], { type: 'text/plain;charset=utf-8' }))
    await writer.close()
  } catch (error) {
    await writer.abort().catch(() => {})
    throw error
  }
}
