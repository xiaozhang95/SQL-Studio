import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import './icons.mjs'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const cli = require.resolve('electron/cli.js')
const env = { ...process.env, ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/' }
// 即便包管理器没有把 .npmrc 转成环境变量，Electron 首次运行下载也使用镜像。
delete env.ELECTRON_RUN_AS_NODE

// 受限终端（沙箱、白名单管控）会阻止 Chromium 初始化自身沙箱，主进程在执行 main.mjs 之前
// 就以 STATUS_BREAKPOINT(0x80000003) 或访问冲突(0xC0000005) 退出，且不打印任何日志。
// 这种情况下保持原数据目录设置，关闭 Electron 沙箱重试一次。
// Windows 下 Node 上报的是无符号 DWORD，shell 里显示为负数，因此统一按 32 位无符号比较。
const RESTRICTED_EXIT_CODES = new Set([0x80000003, 0xc0000005])

function launch(extraArguments, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '.', ...extraArguments], { cwd: root, env: environment, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })
}

const forwarded = process.argv.slice(2)
let exitCode
try {
  exitCode = await launch(forwarded, env)
  if (RESTRICTED_EXIT_CODES.has(exitCode >>> 0) && !forwarded.includes('--no-sandbox')) {
    console.warn(`\n[electron] 当前终端限制了 Chromium 沙箱（退出码 ${exitCode}），已自动降级重试。`)
    console.warn('[electron] 本次关闭 Electron 沙箱，仅用于本机调试。\n')
    exitCode = await launch([...forwarded, '--no-sandbox'], env)
    if (RESTRICTED_EXIT_CODES.has(exitCode >>> 0)) {
      console.error('[electron] 降级后仍无法启动：请换到系统自带终端运行，或把本项目加入安全软件信任区。')
    }
  }
} catch (error) {
  console.error(error.message)
  exitCode = 1
}
// 0x80000003 / 0xC0000005 这类崩溃码对 shell 没有意义，统一收敛成 1。
process.exitCode = RESTRICTED_EXIT_CODES.has(exitCode >>> 0) ? 1 : exitCode
