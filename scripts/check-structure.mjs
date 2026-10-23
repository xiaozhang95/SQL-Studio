import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendOnly = process.argv.includes('--frontend')
const failures = []
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(directory, entry.name)
  return entry.isDirectory() ? walk(full) : [full]
})
const frontend = path.join(root, 'sql-web/src')
for (const file of walk(frontend).filter(file => /\.tsx?$/.test(file))) {
  const relative = path.relative(frontend, file).replaceAll('\\', '/')
  if (relative === 'App.tsx' || relative === 'main.tsx') continue
  if (!/^index\.tsx?$/.test(path.basename(file))) failures.push('模块入口必须为 index.ts(x): ' + relative)
  if (!fs.existsSync(path.join(path.dirname(file), 'README.md'))) failures.push('缺少模块 README: ' + relative)
}
if (!frontendOnly) {
  for (const layer of ['internal', 'cmd', 'tests']) {
    const base = path.join(root, 'sql-server', layer)
    for (const file of walk(base).filter(file => file.endsWith('.go'))) {
      if (!fs.existsSync(path.join(path.dirname(file), 'README.md'))) failures.push('Go 包缺少 README: ' + path.relative(root, file))
    }
  }
}
const bases = ['docs', 'sql-web/src', ...(frontendOnly ? [] : ['sql-server/internal', 'sql-server/cmd', 'sql-server/tests', '.agents/skills'])]
const markdown = [path.join(root, 'README.md'), path.join(root, 'sql-web/README.md'), ...bases.filter(base=>fs.existsSync(path.join(root, base))).flatMap(base=>walk(path.join(root, base)).filter(file=>file.endsWith('.md')))]
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
if (failures.length) { process.stderr.write(failures.join('\n') + '\n'); process.exitCode = 1 }
else process.stdout.write('目录入口、模块 README 与文档链接检查通过。\n')
