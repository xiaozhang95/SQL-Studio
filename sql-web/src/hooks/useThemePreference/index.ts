import { useLayoutEffect, useState, useSyncExternalStore } from 'react'

import type { ThemePreference } from '@/typings/theme'
import { readLocal, saveLocal } from '@/utils/storage'

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const subscribeTheme = (listener: () => void) => {
  systemTheme.addEventListener('change', listener)
  return () => systemTheme.removeEventListener('change', listener)
}
const getSystemTheme = () => systemTheme.matches

/** 统一保存用户偏好，并在首帧绘制前同步主题，避免闪烁。 */
export const useThemePreference = () => {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const saved = readLocal<unknown>('sqldesk.theme', 'system')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })
  const systemDark = useSyncExternalStore(subscribeTheme, getSystemTheme)
  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode
    saveLocal('sqldesk.theme', preference)
  }, [mode, preference])

  return { preference, setPreference, mode }
}
