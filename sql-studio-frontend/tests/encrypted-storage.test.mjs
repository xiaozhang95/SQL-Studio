import assert from 'node:assert/strict'
import test from 'node:test'

import 'fake-indexeddb/auto'

import { readEncrypted, writeEncrypted } from '../src/utils/encryptedStorage/index.ts'

async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sqloom-encrypted', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function raw(store, name) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(name)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function replace(name, envelope) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite')
    tx.objectStore('records').put(envelope, name)
    tx.oncomplete = resolve
    tx.onabort = () => reject(tx.error)
  })
}

test('round trips workspace data without plaintext and keeps the key nonextractable', async () => {
  const value = { sql: 'SELECT 987654321 AS encrypted_marker;', rows: [['9007199254740993', null, '历史记录']] }
  await writeEncrypted('test-workspace', value)
  assert.deepEqual(await readEncrypted('test-workspace', null), value)
  const envelope = await raw('records', 'test-workspace')
  assert.equal(envelope.version, 1)
  assert.equal(envelope.iv.byteLength, 12)
  assert.ok(!new TextDecoder().decode(envelope.data).includes('encrypted_marker'))
  const key = await raw('keys', 'local-key')
  assert.equal(key.extractable, false)
  await assert.rejects(crypto.subtle.exportKey('raw', key))
})

test('a fresh module instance can decrypt with the persisted browser key', async () => {
  const fresh = await import('../src/utils/encryptedStorage/index.ts?fresh-client')
  assert.equal((await fresh.readEncrypted('test-workspace', null)).sql, 'SELECT 987654321 AS encrypted_marker;')
})

test('each write has a new nonce and the latest concurrent edit wins', async () => {
  await writeEncrypted('test-order', { version: 0 })
  const first = await raw('records', 'test-order')
  await writeEncrypted('test-order', { version: 0 })
  const second = await raw('records', 'test-order')
  assert.notDeepEqual(first.iv, second.iv)
  assert.notDeepEqual(first.data, second.data)
  await Promise.all(Array.from({ length: 20 }, (_, version) => writeEncrypted('test-order', { version })))
  assert.deepEqual(await readEncrypted('test-order', null), { version: 19 })
})

test('modified ciphertext and records swapped between names fail authentication', async () => {
  await writeEncrypted('test-original', { sql: 'SELECT 1;' })
  const envelope = await raw('records', 'test-original')
  await replace('test-swapped', envelope)
  await assert.rejects(readEncrypted('test-swapped', { silentFallback: true }))
  const modified = structuredClone(envelope)
  new Uint8Array(modified.data)[0] ^= 1
  await replace('test-original', modified)
  await assert.rejects(readEncrypted('test-original', { silentFallback: true }))
  assert.deepEqual(await raw('records', 'test-original'), modified)
})

test('invalid values fail without replacing the last committed record', async () => {
  await writeEncrypted('test-invalid', { sql: 'SELECT 1;' })
  await assert.rejects(writeEncrypted('test-invalid', { value: 1n }))
  await assert.rejects(writeEncrypted('test-invalid', undefined))
  assert.deepEqual(await readEncrypted('test-invalid', null), { sql: 'SELECT 1;' })
})
