import type { Language } from '../../typings/theme/index.ts'
import { getLanguage } from '../language/index.ts'
import { sqlFilename } from '../sqlExport/index.ts'
import { translate } from '../translate/index.ts'

type Writer = { write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }
type SavePicker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable(): Promise<Writer> }>

/** Start from a user gesture. Native writes remain uncommitted until successful close. */
export async function createExportWriter(title: string, language: Language = getLanguage(), signal?: AbortSignal) {
  const t = (message: string) => translate(message, language)
  const filename = sqlFilename(title)
  const desktop = window.sqlStudioDesktop
  if (desktop?.saveFile?.append) {
    const begun = await desktop.saveFile.begin(filename, t('SQL 文件'))
    if (begun.canceled) throw new DOMException('save canceled', 'AbortError')
    const id = begun.id
    let discarding: Promise<void> | undefined
    const abort = () => (discarding ??= desktop.saveFile.discard(id).catch(() => {}))
    if (signal?.aborted) {
      await abort()
      signal.throwIfAborted()
    }
    signal?.addEventListener('abort', abort, { once: true })
    const detach = () => signal?.removeEventListener('abort', abort)
    const encoder = new TextEncoder()
    const chunkSize = 1024 * 1024
    let bytes = 0
    return {
      filename,
      completion: t('导出成功，文件已保存'),
      destination: begun.filePath,
      write: async (sql: string) => {
        // Keep each IPC request small and avoid splitting a UTF-16 surrogate pair.
        for (let start = 0; start < sql.length;) {
          signal?.throwIfAborted()
          let end = Math.min(start + chunkSize, sql.length)
          const last = sql.charCodeAt(end - 1)
          if (end < sql.length && last >= 0xd800 && last <= 0xdbff) end--
          const chunk = encoder.encode(sql.slice(start, end))
          await desktop.saveFile.append(id, chunk)
          bytes += chunk.byteLength
          start = end
        }
        return bytes
      },
      close: async () => {
        try {
          signal?.throwIfAborted()
          await desktop.saveFile.commit(id)
        } finally {
          detach()
        }
      },
      abort: async () => {
        detach()
        await abort()
      }
    }
  }
  const target: Window & { showSaveFilePicker?: SavePicker } = window
  const handle = target.showSaveFilePicker ? await target.showSaveFilePicker({ suggestedName: filename, types: [{ description: t('SQL 文件'), accept: { 'text/plain': ['.sql'] } }] }) : undefined
  const writer = handle ? await handle.createWritable() : undefined
  let parts: Blob[] = [],
    bytes = 0
  return {
    filename,
    completion: writer ? t('导出成功，文件已保存') : t('导出成功，已发起浏览器下载'),
    destination: filename + (writer ? t('（所选文件）') : t('（浏览器下载）')),
    write: async (sql: string) => {
      const part = new Blob([sql], { type: 'text/plain;charset=utf-8' })
      bytes += part.size
      if (writer) await writer.write(part)
      else {
        if (bytes > 256 * 1024 * 1024) throw new Error(t('当前浏览器下载缓存超过 256 MiB，请使用支持文件流写入的浏览器重试'))
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
