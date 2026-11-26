import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

export function renderAppIcon(platform) {
  const source = readFileSync(new URL('../../sql-studio-frontend/public/studio.svg', import.meta.url), 'utf8')
  // 收紧 Windows 小尺寸图标的透明留白，保留完整轮廓及阴影。
  const svg = platform === 'win32' ? source.replace(/viewBox="[^"]+"/, 'viewBox="83 -2 520 520"') : source
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng()
}

export function writeAppIcons() {
  mkdirSync(fileURLToPath(new URL('../build/icons/', import.meta.url)), { recursive: true })
  writeFileSync(new URL('../build/icons/icon.png', import.meta.url), renderAppIcon())
  writeFileSync(new URL('../build/icons/windows-icon.png', import.meta.url), renderAppIcon('win32'))
}
