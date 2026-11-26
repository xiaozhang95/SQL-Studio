import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { readStartupAppearance } from '../src/startup/appearance.mjs'

test('启动页仅允许声明哈希对应的内联样式，应用蓝取自 Logo', async () => {
  const html = (await readFile(new URL('../src/startup/index.html', import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1]
  assert.ok(css)
  const hash = createHash('sha256').update(css).digest('base64')
  assert.ok(html.includes(`style-src 'sha256-${hash}'`))
  const logo = await readFile(new URL('../../sql-studio-frontend/public/studio.svg', import.meta.url), 'utf8')
  const color = css.match(/--brand:\s*(#[0-9a-f]{6})/i)?.[1]
  assert.ok(color && logo.toLowerCase().includes(color.toLowerCase()))
})

test('固定亮暗主题优先于系统，system 与未配置时跟随系统', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sql-studio-startup-theme-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'appearance.json')
  assert.deepEqual(await readStartupAppearance(directory, true), { preference: 'system', dark: true, language: 'zh-CN' })
  for (const [preference, systemDark, dark, language] of [
    ['light', true, false, 'en-US'],
    ['dark', false, true, 'zh-CN'],
    ['system', true, true, 'en-US'],
    ['system', false, false, 'zh-CN']
  ]) {
    await writeFile(file, JSON.stringify({ schemaVersion: 1, data: { theme: preference, fontSize: 'standard', language } }))
    assert.deepEqual(await readStartupAppearance(directory, systemDark), { preference, dark, language })
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
    assert.deepEqual(await readStartupAppearance(directory, false), { preference: 'system', dark: false, language: 'zh-CN' })
    assert.equal(await readFile(file, 'utf8'), content)
  }
})
