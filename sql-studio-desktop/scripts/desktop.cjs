const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')

const desktop = path.resolve(__dirname, '..')
const root = path.resolve(desktop, '..')
const mirror = 'https://npmmirror.com/mirrors/electron/'
const env = {
  ...process.env,
  ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || mirror,
  ELECTRON_BUILDER_BINARIES_MIRROR: process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/'
}
// Electron must run as a desktop application even when launched from a Node-oriented host.
delete env.ELECTRON_RUN_AS_NODE

function run(command, args, cwd = desktop) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} failed (${code ?? signal})`)))
  })
}

async function build() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('当前桌面打包支持 Windows x64，请在 Windows x64 主机执行。')
  await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'build.ps1'), '-TargetOS', 'windows', '-TargetArch', 'amd64'], root)
  const destination = path.join(desktop, 'runtime', 'backend')
  await fs.mkdir(destination, { recursive: true })
  await fs.copyFile(path.join(root, 'release', 'sql-studio-windows-amd64.exe'), path.join(destination, 'sql-studio-backend.exe'))
}

async function main() {
  const action = process.argv[2]
  if (!['start', 'build', 'pack', 'dist'].includes(action)) throw new Error('使用 pnpm start / build / run pack / dist')
  if (action === 'build') return build()
  if (action !== 'start') await build()
  await fs.access(path.join(desktop, 'runtime', 'backend', 'sql-studio-backend.exe')).catch(() => { throw new Error('缺少内置后端，请先运行 pnpm build。') })
  // Electron 45 downloads on demand rather than in postinstall. Pass the mirror explicitly.
  await run(process.execPath, [require.resolve('electron/install.js')])
  if (action === 'start') return run(require('electron'), [desktop])
  const cli = require.resolve('electron-builder/cli.js')
  await run(process.execPath, [cli, '--win', ...(action === 'pack' ? ['--dir'] : []), '--x64', '--publish', 'never'])
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
