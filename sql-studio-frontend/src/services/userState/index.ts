import { request, RequestError } from '../../utils/request/index.ts'

type Document<T> = { schemaVersion: number; revision: number; updatedAt: string; data: T | null }
const reads = new Map<string, Promise<Document<unknown>>>()
const documents = new Map<string, Document<unknown>>()
const revisions = new Map<string, number>()
const writes = new Map<string, Promise<void>>()
/** Go 是唯一持久化目标；缺失分区才使用调用方默认值，读取失败不回退并覆盖配置。 */
export async function readState<T>(section: string, defaults: () => Promise<T>): Promise<T> {
  let pending = reads.get(section)
  if (!pending) {
    pending = request<Document<unknown>>('/state/' + encodeURIComponent(section))
    reads.set(section, pending)
  }
  const received = await pending
  const doc = documents.get(section) || received
  if (doc.schemaVersion !== 1 || !Number.isSafeInteger(doc.revision) || doc.revision < 0) throw new Error('用户配置版本不受支持')
  if (!revisions.has(section)) revisions.set(section, doc.revision)
  documents.set(section, doc)
  return doc.data === null ? defaults() : (doc.data as T)
}
export function writeState(section: string, value: unknown): Promise<void> {
  return writeSerializedState(section, JSON.stringify(value))
}

/** Accept trusted pre-serialized internal state without a parse/stringify round trip. */
export function writeSerializedState(section: string, data: string): Promise<void> {
  const task = (writes.get(section) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const revision = revisions.get(section)
      if (revision === undefined) throw new Error('配置尚未读取，拒绝覆盖')
      const doc = await request<Document<unknown>>('/state/' + encodeURIComponent(section), { method: 'PUT', body: `{"revision":${revision},"data":${data}}` }).catch((error: unknown) => {
        if (error instanceof RequestError && error.status === 409) throw new RequestError('配置保存冲突：其他窗口已更新本机配置。当前内容尚未保存，请通过恢复入口导出副本并重新载入。', 409)
        throw error
      })
      if (doc.schemaVersion !== 1 || !Number.isSafeInteger(doc.revision) || doc.revision <= revision) throw new Error('配置保存响应无效')
      revisions.set(section, doc.revision)
      documents.set(section, doc)
    })
  writes.set(section, task)
  return task
}
