import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = readFileSync(new URL('../src/pages/workspace/hooks/useDesktopLifecycle/index.ts', import.meta.url), 'utf8')
const implementation = stripTypeScriptTypes(source.slice(source.indexOf('export async function waitForDesktopSave'), source.indexOf('export function useDesktopLifecycle')))
const waitForDesktopSave = new Function(implementation.replace('export ', '') + ';return waitForDesktopSave')()

test('desktop close flushes live drafts before waiting for actual persistence', async () => {
  let frame = 0,
    flushed = false
  await waitForDesktopSave(
    () => ({ ready: true, saving: frame < 5, blocked: false }),
    () => {
      flushed = true
    },
    async () => {
      assert.ok(flushed)
      frame++
    }
  )
  assert.equal(frame, 5)
})

test('desktop close preserves the window on save errors, loading, dirty operations and timeout', async () => {
  const frame = async () => {}
  for (const state of [
    { ready: true, saving: false, blocked: false, error: 'disk write failed' },
    { ready: false, saving: false, blocked: false },
    { ready: true, saving: false, blocked: true }
  ])
    await assert.rejects(
      waitForDesktopSave(
        () => state,
        () => {},
        frame
      )
    )
  await assert.rejects(
    waitForDesktopSave(
      () => ({ ready: true, saving: true, blocked: false }),
      () => {},
      frame,
      -1
    ),
    /超时/
  )
})
