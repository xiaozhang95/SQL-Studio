import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = readFileSync(new URL('../src/pages/workspace/hooks/useSQLImport/index.ts', import.meta.url), 'utf8')
const implementation = stripTypeScriptTypes(source.slice(source.indexOf('const maxSQLFileBytes')).replace('export const useSQLImport', 'const useSQLImport'))

async function loadFile(file) {
  let draft, error
  const App = { useApp: () => ({ message: { success() {} } }) }
  const Upload = { LIST_IGNORE: Symbol() }
  const useState = (initial) => [
    initial,
    (value) => {
      if (typeof initial === 'string') error = value
    }
  ]
  const create = new Function('App', 'Upload', 'useState', implementation + '\nreturn useSQLImport')(App, Upload, useState)
  const outcome = await create((sql, title) => (draft = { sql, title })).beforeImport(file)
  assert.equal(outcome, Upload.LIST_IGNORE)
  return { draft, error }
}

test('import keeps a large UTF-8 script intact in its new editor draft', async () => {
  const sql = "INSERT INTO fixture VALUES ('中文');\n".repeat(66000)
  assert.ok(Buffer.byteLength(sql) > 2 * 1024 * 1024)
  const { draft, error } = await loadFile(new File(['\uFEFF', sql], 'fixture.SQL'))
  assert.equal(error, '')
  assert.deepEqual(draft, { sql, title: 'fixture.SQL' })
})

test('import accepts a 16 MiB file and rejects larger, empty and invalid files', async () => {
  const max = 16 * 1024 * 1024
  assert.equal((await loadFile(new File(['SELECT 1;', ' '.repeat(max - 9)], 'bounded.sql'))).error, '')
  const cases = [
    ['large.sql', new Uint8Array(max + 1), /16 MiB/],
    ['empty.sql', ' \n', /为空/],
    ['invalid.sql', new Uint8Array([0xc3, 0x28]), /UTF-8/],
    ['other.txt', 'SELECT 1;', /\.sql/]
  ]
  for (const [name, data, message] of cases) {
    const { draft, error } = await loadFile(new File([data], name))
    assert.equal(draft, undefined)
    assert.match(error, message)
  }
})
