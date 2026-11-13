import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeAppIcons } from './icons.mjs'

const project = fileURLToPath(new URL('..', import.meta.url))
const root = path.dirname(project)
const runtime = path.join(project, 'build/runtime')
const goOS = { darwin: 'darwin', win32: 'windows', linux: 'linux' }[process.platform]
const goArch = { arm64: 'arm64', x64: 'amd64' }[process.arch]
if (!goOS || !goArch) throw new Error('桌面构建目前支持 macOS / Windows / Linux 的 x64 和 arm64。')

function run(command, args, cwd, env = process.env) {
  const shell = process.platform === 'win32' && command === 'pnpm'
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 构建失败（${result.status}）`)
}

writeAppIcons()
// 只清理 Electron 自己的运行资源目录，保留现有 release。
rmSync(runtime, { recursive: true, force: true })
mkdirSync(runtime, { recursive: true })
run('pnpm', ['build'], path.join(root, 'sql-studio-frontend'))
cpSync(path.join(root, 'sql-studio-frontend/dist'), path.join(runtime, 'web'), { recursive: true })
const binary = path.join(runtime, process.platform === 'win32' ? 'sql-studio-backend.exe' : 'sql-studio-backend')
const goEnvironment = {
  ...process.env,
  GOOS: goOS,
  GOARCH: goArch,
  CGO_ENABLED: '0'
}
run('go', ['build', '-trimpath', '-o', binary, '.'], path.join(root, 'sql-studio-backend'), goEnvironment)
if (goOS === 'windows') {
  // electron-builder 写入图标和版本资源时要求启动器没有 COFF 符号表。
  run('go', [
    'build', '-trimpath', '-ldflags', '-H=windowsgui -s -w',
    '-o', 'build/launcher.exe', './scripts/windows/launcher_windows.go'
  ], project, goEnvironment)
}
