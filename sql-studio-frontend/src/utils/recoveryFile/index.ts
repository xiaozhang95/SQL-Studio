type Picker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>
}>

/** The caller keeps the page open; a browser download is not a completed file write. */
export async function saveRecoveryFile(value: unknown): Promise<string> {
  const data = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const filename = `sql-studio-recovery-${Date.now()}.json`
  const target: Window & { showSaveFilePicker?: Picker } = window
  if (target.showSaveFilePicker) {
    const handle = await target.showSaveFilePicker({ suggestedName: filename, types: [{ description: '工作区恢复副本', accept: { 'application/json': ['.json'] } }] })
    const writer = await handle.createWritable()
    try {
      await writer.write(data)
      await writer.close()
    } catch (error) {
      await writer.abort().catch(() => {})
      throw error
    }
    return '恢复副本已保存，可以重新载入。'
  }
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return '已发起恢复副本下载，请确认文件下载完成后再重新载入。'
}
