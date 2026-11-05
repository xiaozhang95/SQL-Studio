import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

// 网页 favicon 为唯一图标源，桌面 PNG 从 SVG 生成，不复制维护另一套 Logo。
const source = readFileSync(new URL('../../sql-studio-frontend/public/studio.svg', import.meta.url))
const directory = fileURLToPath(new URL('../build/icons/', import.meta.url))
mkdirSync(directory, { recursive: true })
writeFileSync(new URL('../build/icons/icon.png', import.meta.url), new Resvg(source, { fitTo: { mode: 'width', value: 1024 } }).render().asPng())

// macOS Dock 图标在 1024px 画布内保留透明安全区，与系统图标的视觉尺寸一致。
const macSource = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${source.toString().replace('<svg ', '<svg x="100" y="100" width="824" height="824" ')}</svg>`
writeFileSync(new URL('../build/icons/mac-icon.png', import.meta.url), new Resvg(macSource).render().asPng())
