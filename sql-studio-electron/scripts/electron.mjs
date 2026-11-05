import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import './icons.mjs'

const require = createRequire(import.meta.url)
const env = { ...process.env, ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/' }
// 即便包管理器没有把 .npmrc 转成环境变量，Electron 首次运行下载也使用镜像。
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(process.execPath, [require.resolve('electron/cli.js'), '.', ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env,
  stdio: 'inherit'
})
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
