import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('模块入口、README、样式归属和文档链接保持有效', () => {
  const failures = []
  const walk = (directory) =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(directory, entry.name)
      return entry.isDirectory() ? walk(full) : [full]
    })
  const frontend = path.join(root, 'sql-studio-frontend/src')
  for (const file of walk(frontend).filter((file) => /\.(?:scss|css)$/.test(file))) {
    if (path.relative(frontend, file) === 'app.scss') continue
    const source = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    if (/\.ant-|\.anticon\b|\[\s*class[^\]\n]*ant-/.test(source)) failures.push('Ant Design 原生样式覆盖只能放在 app.scss: ' + path.relative(frontend, file))
  }
  for (const file of walk(frontend).filter((file) => /\.tsx?$/.test(file))) {
    const relative = path.relative(frontend, file).replaceAll('\\', '/')
    if (relative === 'App.tsx' || relative === 'main.tsx') continue
    if (!/^index\.tsx?$/.test(path.basename(file))) failures.push('模块入口必须为 index.ts(x): ' + relative)
    if (!fs.existsSync(path.join(path.dirname(file), 'README.md'))) failures.push('缺少模块 README: ' + relative)
  }
  const bases = ['docs', 'sql-studio-frontend/src', 'sql-studio-backend/internal', 'sql-studio-backend/cmd', 'sql-studio-backend/tests', '.agents/skills']
  const markdown = [
    path.join(root, 'AGENTS.md'),
    path.join(root, 'README.md'),
    path.join(root, 'sql-studio-frontend/README.md'),
    path.join(root, 'sql-studio-backend/README.md'),
    ...bases.filter((base) => fs.existsSync(path.join(root, base))).flatMap((base) => walk(path.join(root, base)).filter((file) => file.endsWith('.md')))
  ]
  for (const file of markdown) {
    // 只审计实际 Markdown 链接，不把代码示例里的语法当成本地文件。
    const source = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, '').split('#')[0]
      if (!target || /^(?:[a-z]+:|\/)/i.test(target)) continue
      const local = path.resolve(path.dirname(file), decodeURIComponent(target))
      if (!fs.existsSync(local)) failures.push('失效文档链接: ' + path.relative(root, file) + ' -> ' + target)
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'))
})
