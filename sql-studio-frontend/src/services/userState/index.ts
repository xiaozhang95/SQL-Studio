import { request, RequestError } from '../../utils/request/index.ts'

type Document<T> = { schemaVersion: number; revision: number; updatedAt: string; data: T | null }
const reads = new Map<string, Promise<Document<unknown>>>()
const documents = new Map<string, Document<unknown>>()
const generations = new Map<string, number>()
const writes = new Map<string, Promise<void>>()
/** Go 是唯一持久化目标；缺失分区才使用调用方默认值，读取失败不回退并覆盖配置。 */
export async function readState<T>(section: string, defaults: () => Promise<T>): Promise<T> {
  const doc = documents.get(section) ?? (await readDocument(section))
  return doc.data === null ? defaults() : (doc.data as T)
}

async function readDocument(section: string) {
  let pending = reads.get(section)
  if (!pending) {
    pending = request<Document<unknown>>('/state/' + encodeURIComponent(section)).finally(() => reads.delete(section))
    reads.set(section, pending)
  }
  const doc = await pending
  if (doc.schemaVersion !== 1 || !Number.isSafeInteger(doc.revision) || doc.revision < 0) throw new Error('用户配置版本不受支持')
  documents.set(section, doc)
  return doc
}
export function writeState(section: string, value: unknown) {
  const generation = generations.get(section) ?? 0
  const data = JSON.stringify(value)
  const task = (writes.get(section) || Promise.resolve()).then(async () => {
    const current = documents.get(section)
    if (!current) throw new Error('配置尚未读取，拒绝覆盖')
    if ((generations.get(section) ?? 0) !== generation) return { saved: false as const, data: current.data }
    try {
      const doc = await request<Document<unknown>>('/state/' + encodeURIComponent(section), { method: 'PUT', body: `{"revision":${current.revision},"data":${data}}` })
      if (doc.schemaVersion !== 1 || !Number.isSafeInteger(doc.revision) || doc.revision <= current.revision) throw new Error('配置保存响应无效')
      documents.set(section, doc)
      return { saved: true as const }
    } catch (error) {
      if (!(error instanceof RequestError) || error.status !== 409) throw error
      const latest = await readDocument(section)
      generations.set(section, generation + 1)
      return { saved: false as const, data: latest.data }
    }
  })
  writes.set(
    section,
    task.then(
      () => {},
      () => {}
    )
  )
  return task
}
