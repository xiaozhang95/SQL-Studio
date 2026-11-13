import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createSQLSaves } from '../src/sql-save.mjs'

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'sql-studio-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return { directory, filePath: path.join(directory, '原始 😀.sql') }
}

test('streamed SQL only replaces the destination after commit and cannot be committed twice', async (t) => {
  const { directory, filePath } = await fixture(t)
  await writeFile(filePath, 'original')
  const saves = createSQLSaves(async () => ({ filePath }))
  const { id } = await saves.begin('query.sql')
  const chunk = Buffer.from('中文😀;\n'.repeat(150000))
  const expected = createHash('sha256')
  for (let index = 0; index < 12; index++) {
    await saves.append(id, chunk)
    expected.update(chunk)
  }
  assert.equal(await readFile(filePath, 'utf8'), 'original')
  const committing = saves.commit(id)
  assert.throws(() => saves.commit(id), /已结束/)
  await committing
  assert.equal(createHash('sha256').update(await readFile(filePath)).digest('hex'), expected.digest('hex'))
  assert.deepEqual(await readdir(directory), [path.basename(filePath)])
})

test('picker cancellation, reset during write and failed replacement leave the destination intact', async (t) => {
  const { directory, filePath } = await fixture(t)
  const cancelled = createSQLSaves(async () => ({ canceled: true }))
  assert.deepEqual(await cancelled.begin('query.sql'), { canceled: true })
  assert.deepEqual(await readdir(directory), [])
  await writeFile(filePath, 'original')
  const saves = createSQLSaves(async () => ({ filePath }))
  await assert.rejects(saves.begin('../query.sql'), /无效/)
  const { id } = await saves.begin('query.sql')
  await assert.rejects(saves.append(id, 'not bytes'), /无效/)
  const writing = saves.append(id, Buffer.from('partial'))
  await saves.reset()
  await writing
  assert.throws(() => saves.commit(id), /已结束/)
  assert.equal(await readFile(filePath, 'utf8'), 'original')
  assert.deepEqual(await readdir(directory), [path.basename(filePath)])

  const existingDirectory = path.join(directory, 'not-a-file.sql')
  await mkdir(existingDirectory)
  const blocked = createSQLSaves(async () => ({ filePath: existingDirectory }))
  const failed = await blocked.begin('query.sql')
  await blocked.append(failed.id, Buffer.from('partial'))
  await assert.rejects(blocked.commit(failed.id))
  assert.deepEqual(await readdir(existingDirectory), [])
  assert.equal((await readdir(directory)).some((name) => name.startsWith('.sql-studio-save-')), false)
})

test('a pending picker cannot create a save session after its renderer is reset', async (t) => {
  const { directory, filePath } = await fixture(t)
  let select
  const saves = createSQLSaves(() => new Promise((resolve) => { select = resolve }))
  const pending = saves.begin('query.sql')
  await assert.rejects(saves.begin('second.sql'), /正在保存/)
  await saves.reset()
  select({ filePath })
  assert.deepEqual(await pending, { canceled: true })
  assert.deepEqual(await readdir(directory), [])
})

test('discard during commit prevents replacement until publication', async (t) => {
  const { directory, filePath } = await fixture(t)
  await writeFile(filePath, 'original')
  const saves = createSQLSaves(async () => ({ filePath }))
  const { id } = await saves.begin('query.sql')
  await saves.append(id, Buffer.from('replacement'))
  const committing = saves.commit(id)
  const discard = saves.discard(id)
  await assert.rejects(committing, /已取消/)
  await assert.rejects(discard, /已取消/)
  assert.equal(await readFile(filePath, 'utf8'), 'original')
  assert.deepEqual(await readdir(directory), [path.basename(filePath)])
})
