import assert from 'node:assert/strict'
import test from 'node:test'

import { readState, writeState } from '../src/services/userState/index.ts'

test('conflict returns the latest configuration, drops queued stale writes, and permits fresh edits', async () => {
  const original = globalThis.fetch
  let server = { schemaVersion: 1, revision: 2, updatedAt: '', data: { theme: 'dark' } }
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (options?.method === 'PUT') {
      const input = JSON.parse(options.body)
      if (input.revision !== server.revision) return new Response(JSON.stringify({ error: 'conflict' }), { status: 409 })
      server = { ...server, revision: server.revision + 1, data: input.data }
    }
    return new Response(JSON.stringify(server), { status: 200 })
  }
  try {
    const saved = await readState('test-appearance', async () => {
      throw Error('must not initialize an existing document')
    })
    assert.equal(saved.theme, 'dark')
    await Promise.all([writeState('test-appearance', { theme: 'light' }), writeState('test-appearance', { theme: 'system' })])
    assert.equal(server.revision, 4)
    assert.equal(server.data.theme, 'system')
    assert.equal((await readState('test-appearance', async () => ({}))).theme, 'system')
    server = { ...server, revision: 5, data: { theme: 'dark' } }
    const conflicts = await Promise.all([writeState('test-appearance', { theme: 'light' }), writeState('test-appearance', { theme: 'system' })])
    assert.deepEqual(conflicts, Array(2).fill({ saved: false, data: { theme: 'dark' } }))
    assert.equal((await readState('test-appearance', async () => ({}))).theme, 'dark')
    assert.equal(server.data.theme, 'dark')
    assert.equal(calls.filter((c) => c.options?.method === 'PUT').length, 3)
    assert.deepEqual(await writeState('test-appearance', { theme: 'light' }), { saved: true })
    assert.equal(server.data.theme, 'light')
  } finally {
    globalThis.fetch = original
  }
})
test('only missing documents initialize defaults; unavailable backend does not overwrite', async () => {
  const original = globalThis.fetch
  let reads = 0
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ schemaVersion: 1, revision: 0, updatedAt: '', data: null }))
    assert.deepEqual(
      await readState('test-initialization', async () => {
        reads++
        return { version: 1 }
      }),
      { version: 1 }
    )
    assert.equal(reads, 1)
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 })
    await assert.rejects(
      readState('test-unavailable', async () => {
        reads++
        return {}
      }),
      /unavailable/
    )
    assert.equal(reads, 1)
    globalThis.fetch = async () => new Response(JSON.stringify({ schemaVersion: 1, revision: 2, updatedAt: '', data: { version: 2 } }))
    assert.deepEqual(await readState('test-unavailable', async () => ({})), { version: 2 })
  } finally {
    globalThis.fetch = original
  }
})
