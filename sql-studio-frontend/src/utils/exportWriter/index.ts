type Writer = { write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }
type SavePicker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable(): Promise<Writer> }>

/** Start from a user gesture. Native writes remain uncommitted until successful close. */
export async function createExportWriter(title: string) {
  const filename = Array.from(title, (char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char)).join('') + '.sql'
  const target: Window & { showSaveFilePicker?: SavePicker } = window
  const handle = target.showSaveFilePicker ? await target.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'SQL 文件', accept: { 'text/plain': ['.sql'] } }] }) : undefined
  const writer = handle ? await handle.createWritable() : undefined
  let parts: Blob[] = [],
    bytes = 0
  return {
    filename,
    completion: writer ? '导出成功，文件已保存' : '导出成功，已发起浏览器下载',
    destination: writer ? filename + '（所选文件）' : filename + '（浏览器下载）',
    write: async (sql: string) => {
      const part = new Blob([sql], { type: 'text/plain;charset=utf-8' })
      bytes += part.size
      if (writer) await writer.write(part)
      else {
        if (bytes > 256 * 1024 * 1024) throw new Error('当前浏览器下载缓存超过 256 MiB，请使用支持文件流写入的浏览器重试')
        parts.push(part)
      }
      return bytes
    },
    close: async () => {
      if (writer) await writer.close()
      else {
        const url = URL.createObjectURL(new Blob(parts, { type: 'text/plain;charset=utf-8' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        document.body.append(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      parts = []
    },
    abort: async () => {
      parts = []
      await writer?.abort().catch(() => {})
    }
  }
}
