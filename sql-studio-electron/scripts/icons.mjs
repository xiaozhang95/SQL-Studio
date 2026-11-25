import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

export function renderAppIcon(dock = false) {
  const source = readFileSync(new URL('../../sql-studio-frontend/public/studio.svg', import.meta.url), 'utf8')
  let svg = source
  if (dock) {
    // 只替换根元素的视口属性，保留 Logo 的 viewBox 和内部图形。
    const dockIcon = source.replace(/<svg\b([^>]*)>/, (_, attributes) => {
      const preserved = attributes.replace(/\s(?:x|y|width|height)\s*=\s*(?:"[^"]*"|'[^']*')/g, '')
      return `<svg x="100" y="100" width="824" height="824"${preserved}>`
    })
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${dockIcon}</svg>`
  }
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng()
}

export function writeAppIcons() {
  mkdirSync(fileURLToPath(new URL('../build/icons/', import.meta.url)), { recursive: true })
  writeFileSync(new URL('../build/icons/icon.png', import.meta.url), renderAppIcon())
  writeFileSync(new URL('../build/icons/mac-icon.png', import.meta.url), renderAppIcon(true))
}
