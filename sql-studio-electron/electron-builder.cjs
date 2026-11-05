// electron-builder 的辅助工具与 Electron 本体分别下载，两个镜像都需要设置。
process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||= 'https://npmmirror.com/mirrors/electron-builder-binaries/'

module.exports = {
  appId: 'com.sqlstudio.desktop',
  productName: 'SQL Studio',
  icon: 'build/icons/icon.png',
  directories: { output: 'release' },
  files: ['src/**/*', 'package.json'],
  asar: true,
  extraResources: [
    { from: 'build/runtime', to: 'runtime' },
    { from: 'build/icons/icon.png', to: 'icon.png' }
  ],
  electronDownload: { mirror: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/' },
  mac: { target: ['dmg'], category: 'public.app-category.developer-tools', identity: null },
  win: { target: ['nsis'] },
  linux: { target: ['AppImage'], category: 'Development' }
}
