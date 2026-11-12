import { spawn } from 'node:child_process'
import { cp, mkdtemp, realpath, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const cli = require.resolve('electron/cli.js')
const env = { ...process.env, ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/' }
// 即便包管理器没有把 .npmrc 转成环境变量，Electron 首次运行下载也使用镜像。
delete env.ELECTRON_RUN_AS_NODE

// Windows 上 Chromium 初始化失败可能在主进程执行前以这两个退出码结束。
// Windows 下 Node 上报的是无符号 DWORD，shell 里显示为负数，因此统一按 32 位无符号比较。
const RESTRICTED_EXIT_CODES = new Set([0x80000003, 0xc0000005])
const isStartupCrash = (code) => RESTRICTED_EXIT_CODES.has(code >>> 0)

function launch(extraArguments, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '.', ...extraArguments], { cwd: root, env: environment, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })
}

async function launchFromTemporaryRuntime(args) {
  const source = path.dirname(require('electron'))
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), 'sql-studio-electron-'))
  try {
    await cp(source, directory, { recursive: true })
    const environment = { ...env, ELECTRON_OVERRIDE_DIST_PATH: directory }
    const code = await launch(args, environment)
    if (!isStartupCrash(code) || args.includes('--no-sandbox')) return code

    console.warn('[electron] 临时运行时仍未通过 Chromium 沙箱初始化，本次预览关闭沙箱重试。')
    return await launch([...args, '--no-sandbox'], environment)
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 }).catch((error) => {
      console.warn(`[electron] 无法清理临时运行时：${error.message}`)
    })
  }
}

const forwarded = process.argv.slice(2)
let exitCode
try {
  exitCode = await launch(forwarded, env)
  if (process.platform === 'win32' && isStartupCrash(exitCode)) {
    console.warn(`[electron] Chromium 启动失败（退出码 ${exitCode}），改用临时运行时重试。`)
    exitCode = await launchFromTemporaryRuntime(forwarded)
    if (isStartupCrash(exitCode)) {
      console.error('[electron] 临时运行时仍无法启动，请检查终端与 Windows 的程序运行限制。')
    }
  }
} catch (error) {
  console.error(error.message)
  exitCode = 1
}
// 0x80000003 / 0xC0000005 这类崩溃码对 shell 没有意义，统一收敛成 1。
process.exitCode = isStartupCrash(exitCode) ? 1 : exitCode
