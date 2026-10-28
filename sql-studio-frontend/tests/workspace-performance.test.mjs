import assert from 'node:assert/strict'
import test from 'node:test'

import { createLatestWriter } from '../src/utils/latestWriter/index.ts'

test('backpressure saves first and latest only; conflicts reject pending saves', async () => {
  let release
  const calls = [],
    save = createLatestWriter(async (value) => {
      calls.push(value)
      if (value === 1)
        await new Promise((resolve) => {
          release = resolve
        })
    })
  const a = save(1),
    b = save(2),
    c = save(3)
  assert.deepEqual(calls, [1])
  release()
  await Promise.all([a, b, c])
  assert.deepEqual(calls, [1, 3])
  let reject
  const broken = createLatestWriter(
    async () =>
      new Promise((_, fail) => {
        reject = fail
      })
  )
  const x = broken('old'),
    y = broken('latest'),
    checks = Promise.all([assert.rejects(x, /conflict/), assert.rejects(y, /conflict/)])
  reject(new Error('conflict'))
  await checks
})
