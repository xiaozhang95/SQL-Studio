import { open } from 'node:fs/promises'
import path from 'node:path'

/** 服务启动前仅读取当前外观配置，不写回默认值。 */
export async function readStartupAppearance(stateDirectory, systemDark) {
  let preference = 'system'
  let file
  try {
    file = await open(path.join(stateDirectory, 'appearance.json'), 'r')
    if ((await file.stat()).size <= 64 * 1024) {
      const document = JSON.parse(await file.readFile('utf8'))
      const settings = document?.data
      if (
        document?.schemaVersion === 1 &&
        ['light', 'dark', 'system'].includes(settings?.theme) &&
        ['small', 'standard', 'large'].includes(settings?.fontSize) &&
        ['zh-CN', 'en-US'].includes(settings?.language)
      ) preference = settings.theme
    }
  } catch {
    // 首次启动、不可读或损坏时只让开屏沿用系统主题，不影响原配置。
  } finally {
    await file?.close()
  }
  return { preference, dark: preference === 'system' ? systemDark : preference === 'dark' }
}
