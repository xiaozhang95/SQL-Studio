// electron-builder 的辅助工具与 Electron 本体分别下载，两个镜像都需要设置。
process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||= 'https://npmmirror.com/mirrors/electron-builder-binaries/'

module.exports = {
  appId: 'com.sqlstudio.desktop',
  productName: 'SQL Studio',
  icon: 'build/icons/icon.png',
  directories: { output: process.env.SQL_STUDIO_OUT || 'release', buildResources: 'build' },
  files: ['src/**/*', 'package.json'],
  asar: true,
  extraResources: [
    { from: 'build/runtime', to: 'runtime' },
    { from: 'build/icons/icon.png', to: 'icon.png' },
    { from: 'build/icons/mac-icon.png', to: 'mac-icon.png' }
  ],
  electronDownload: { mirror: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/' },
  mac: { target: ['dmg'], icon: 'build/icons/mac-icon.png', category: 'public.app-category.developer-tools', identity: null },
  win: {
    target: ['nsis'],
    // Chromium 沙箱初始化失败的机器，可以双击 exe 同级这个脚本（带 --no-sandbox）启动。
    extraFiles: [{ from: 'scripts/launch.cmd', to: '启动 SQL Studio.cmd' }]
  },
  // 默认 oneClick 安装器在某些机器上会静默失败：改成按当前用户安装（%LOCALAPPDATA%），
  // 不申请管理员权限、允许选择目录，普通账户也能装。
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'SQL Studio',
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
    differentialPackage: false,
    // 重建带 --no-sandbox 的快捷方式，见 build/installer.nsh。
    include: 'build/installer.nsh'
  },
  linux: { target: ['AppImage'], category: 'Development' }
}
