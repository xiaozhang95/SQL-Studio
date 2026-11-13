const { execFileSync } = require('node:child_process')
const { access, copyFile, rename } = require('node:fs/promises')
const path = require('node:path')
const { version } = require('../sql-studio-frontend/package.json')

// electron-builder 的辅助工具与 Electron 本体分别下载，两个镜像都需要设置。
process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||= 'https://npmmirror.com/mirrors/electron-builder-binaries/'

module.exports = {
  appId: 'com.sqlstudio.desktop',
  productName: 'SQL Studio',
  extraMetadata: { version },
  icon: 'build/icons/icon.png',
  directories: { output: process.env.SQL_STUDIO_OUT || 'release', buildResources: 'build' },
  files: ['src/**/*', 'package.json'],
  extraResources: [
    { from: 'build/runtime', to: 'runtime' },
    { from: 'build/icons/icon.png', to: 'icon.png' },
    { from: 'build/icons/mac-icon.png', to: 'mac-icon.png' }
  ],
  electronDownload: { mirror: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/' },
  mac: { target: ['dmg'], icon: 'build/icons/mac-icon.png', category: 'public.app-category.developer-tools', identity: null },
  win: {
    target: ['nsis'],
    publish: { provider: 'github', owner: 'xiaozhang95', repo: 'SQL-Studio', vPrefixedTagName: false }
  },
  async beforePack({ electronPlatformName }) {
    const windows = electronPlatformName === 'win32'
    const backend = windows ? 'sql-studio-backend.exe' : 'sql-studio-backend'
    const resources = ['build/runtime/web/index.html', `build/runtime/${backend}`, 'build/icons/icon.png', 'build/icons/mac-icon.png']
    if (windows) resources.push('build/launcher.exe')
    try {
      await Promise.all(resources.map((file) => access(path.join(__dirname, file))))
    } catch (error) {
      throw new Error(`无法读取打包资源。\n${error.message}`)
    }
  },
  async afterPack({ appOutDir, electronPlatformName, packager }) {
    if (electronPlatformName !== 'win32') return
    const executable = path.join(appOutDir, `${packager.appInfo.productFilename}.exe`)
    // 保留安装器和快捷方式使用的入口名，Chromium 及其依赖仍位于同一目录。
    await rename(executable, path.join(appOutDir, 'sql-studio-runtime.exe'))
    await copyFile(path.join(__dirname, 'build', 'launcher.exe'), executable)
  },
  afterSign({ appOutDir, electronPlatformName }) {
    if (electronPlatformName !== 'win32') return
    // 工作区可能带 Low 完整性标签，发行程序需要以普通用户的 Medium 级别运行。
    const icacls = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'icacls.exe')
    try {
      execFileSync(icacls, [appOutDir, '/setintegritylevel', '(OI)(CI)M', '/T', '/C', '/Q'], { windowsHide: true, stdio: 'pipe' })
    } catch (error) {
      throw new Error('无法设置 Windows 发行目录的完整性级别，请从普通 Windows 终端运行 pnpm build。', { cause: error })
    }
  },
  nsis: {
    artifactName: 'SQL-Studio-Setup-${version}-${arch}.${ext}',
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
    differentialPackage: false,
    useZip: true,
    include: 'scripts/windows/installer.nsh'
  },
  linux: { target: ['AppImage'], category: 'Development' }
}
