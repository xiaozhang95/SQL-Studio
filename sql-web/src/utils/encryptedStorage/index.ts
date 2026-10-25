type Envelope = { version: 1; iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }
let database: Promise<IDBDatabase> | undefined
let encryptionKey: Promise<CryptoKey> | undefined
const writes = new Map<string, Promise<void>>()

function openDatabase() {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) return Promise.reject(new Error('当前环境不支持本地加密存储，请使用 HTTPS 或 localhost'))
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('sqloom-encrypted', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('keys')
      request.result.createObjectStore('records')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('本地存储正在被其他页面占用'))
  }))
}

async function getKey() {
  return (encryptionKey ??= (async () => {
    const db = await openDatabase()
    // 不导出原始密钥，不内置口令；多页同时首次启动时以同一读写事务选定密钥。
    const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    return new Promise<CryptoKey>((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite')
      const store = tx.objectStore('keys')
      const request = store.get('local-key')
      let selected: CryptoKey
      request.onsuccess = () => {
        selected = request.result || generated
        if (!request.result) store.put(generated, 'local-key')
      }
      tx.oncomplete = () => resolve(selected)
      tx.onabort = () => reject(tx.error || new Error('无法读取本地密钥'))
    })
  })())
}

export async function readEncrypted<T>(name: string, fallback: T): Promise<T> {
  await writes.get(name)?.catch(() => {})
  const db = await openDatabase()
  const envelope = await new Promise<Envelope | undefined>((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').get(name)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  if (!envelope) return fallback
  if (envelope.version !== 1) throw new Error('本地记录版本不受支持')
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv, additionalData: new TextEncoder().encode(name) }, await getKey(), envelope.data)
  return JSON.parse(new TextDecoder().decode(clear)) as T
}

/** 同一记录顺序落盘，防止旧的异步加密任务覆盖较新的编辑。失败不退回明文。 */
export async function writeEncrypted(name: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value)
  if (json === undefined) throw new Error('无法保存空的本地记录')
  const clear = new TextEncoder().encode(json)
  const task = (writes.get(name) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const db = await openDatabase()
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) }, await getKey(), clear)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite')
        tx.objectStore('records').put({ version: 1, iv, data } satisfies Envelope, name)
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error || new Error('本地存储空间不足或不可用'))
      })
    })
  writes.set(name, task)
  return task
}
