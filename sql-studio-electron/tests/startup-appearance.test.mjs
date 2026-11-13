import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { readStartupAppearance } from '../src/startup/appearance.mjs'

test('固定亮暗主题优先于系统，system 与未配置时跟随系统', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sql-studio-startup-theme-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'appearance.json')
  assert.deepEqual(await readStartupAppearance(directory, true), { preference: 'system', dark: true })
  for (const [preference, systemDark, dark] of [
    ['light', true, false],
    ['dark', false, true],
    ['system', true, true],
    ['system', false, false]
  ]) {
    await writeFile(file, JSON.stringify({ schemaVersion: 1, data: { theme: preference, fontSize: 'standard', language: 'zh-CN' } }))
    assert.deepEqual(await readStartupAppearance(directory, systemDark), { preference, dark })
  }
})

test('损坏、未知版本或非法主题只回退开屏显示，保留原文件', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sql-studio-startup-theme-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'appearance.json')
  for (const content of [
    'invalid',
    'null',
    '{"schemaVersion":2,"data":{"theme":"dark","fontSize":"standard","language":"zh-CN"}}',
    '{"schemaVersion":1,"data":{"theme":"unknown","fontSize":"standard","language":"zh-CN"}}',
    '{"schemaVersion":1,"data":{"theme":"dark","fontSize":"standard"}}',
    ' '.repeat(65537)
  ]) {
    await writeFile(file, content)
    assert.deepEqual(await readStartupAppearance(directory, false), { preference: 'system', dark: false })
    assert.equal(await readFile(file, 'utf8'), content)
  }
})
