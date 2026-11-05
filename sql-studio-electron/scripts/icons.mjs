import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

// 网页 favicon 为唯一图标源，桌面 PNG 从 SVG 生成，不复制维护另一套 Logo。
const source = readFileSync(new URL('../../sql-studio-frontend/public/studio.svg', import.meta.url))
const directory = fileURLToPath(new URL('../build/icons/', import.meta.url))
mkdirSync(directory, { recursive: true })
writeFileSync(new URL('../build/icons/icon.png', import.meta.url), new Resvg(source, { fitTo: { mode: 'width', value: 1024 } }).render().asPng())
