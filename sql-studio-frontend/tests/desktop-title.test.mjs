import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

import { workspacePageTitle } from '../src/pages/workspace/utils/pageTitle/index.ts'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/components/desktopTitleBar/index.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText

function harness(desktop = true) {
  const document = { title: 'SQL Studio', documentElement: { dataset: { theme: 'dark' } } }
  const window = { sqlStudioDesktop: desktop ? { titleBarHeight: 24, setTitleBarTheme() {} } : undefined }
  const exports = {}
  const dependencies = {
    antd: { theme: { useToken: () => ({ token: { colorBgContainer: '#141414', colorTextBase: '#fff' } }) } },
    react: { useEffect: (effect) => effect() }
  }
  new Function('exports', 'require', 'window', 'document', compiled)(exports, (name) => dependencies[name] || require(name), window, document)
  return { document, render: (props) => renderToStaticMarkup(exports.default(props)) }
}

test('真实桌面标题组件同步可见内容和 document.title，切页切库使用最新标题', () => {
  const f = harness()
  const page = { kind: 'query', title: '查询 1', database: 'demo' }
  assert.match(f.render({ title: workspacePageTitle(page) }), /demo · 查询 1/)
  assert.equal(f.document.title, 'demo · 查询 1')
  assert.match(f.render({ title: workspacePageTitle({ ...page, title: '查询 2', database: 'other' }) }), /other · 查询 2/)
  assert.equal(f.document.title, 'other · 查询 2')
  f.render({})
  assert.equal(f.document.title, 'SQL Studio')
})

test('AI 页隐藏最上方标题，后台工作台和普通浏览器不改写窗口标题', () => {
  const f = harness()
  assert.doesNotMatch(f.render({ showTitle: false }), /SQL Studio/)
  assert.equal(f.document.title, 'SQL Studio')
  f.render({ active: false, title: 'background · 查询 9' })
  assert.equal(f.document.title, 'SQL Studio')
  const browser = harness(false)
  assert.equal(browser.render({ title: 'ignored' }), '')
  assert.equal(browser.document.title, 'SQL Studio')
})
