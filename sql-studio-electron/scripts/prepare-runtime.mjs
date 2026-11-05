import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import './icons.mjs'

const project = fileURLToPath(new URL('..', import.meta.url))
const root = path.dirname(project)
const runtime = path.join(project, 'build/runtime')
const goOS = { darwin: 'darwin', win32: 'windows', linux: 'linux' }[process.platform]
const goArch = { arm64: 'arm64', x64: 'amd64' }[process.arch]
if (!goOS || !goArch) throw new Error('桌面构建目前支持 macOS / Windows / Linux 的 x64 和 arm64。')

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 构建失败（${result.status}）`)
}

// 只清理 Electron 自己的生成目录，不改 Go embed 资源或现有 release。
rmSync(runtime, { recursive: true, force: true })
mkdirSync(runtime, { recursive: true })
run('pnpm', ['build'], path.join(root, 'sql-studio-frontend'))
cpSync(path.join(root, 'sql-studio-frontend/dist'), path.join(runtime, 'web'), { recursive: true })
const binary = path.join(runtime, process.platform === 'win32' ? 'sql-studio-backend.exe' : 'sql-studio-backend')
run('go', ['build', '-trimpath', '-o', binary, '.'], path.join(root, 'sql-studio-backend'), {
  ...process.env,
  GOOS: goOS,
  GOARCH: goArch,
  CGO_ENABLED: '0'
})
