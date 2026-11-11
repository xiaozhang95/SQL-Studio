import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'

import { readState, writeState } from '@/services/userState'
import type { FontSizePreference, ThemePreference } from '@/typings/theme'

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const subscribeTheme = (listener: () => void) => {
  systemTheme.addEventListener('change', listener)
  return () => systemTheme.removeEventListener('change', listener)
}
const getSystemTheme = () => systemTheme.matches

/** 统一保存用户偏好，并在首帧绘制前同步主题，避免闪烁。 */
export const useThemePreference = () => {
  const [preference, setPreference] = useState<ThemePreference>('system')
  const [fontSizePreference, setFontSizePreference] = useState<FontSizePreference>('standard')
  const [ready, setReady] = useState(false)
  const [savedPreference, setSavedPreference] = useState<{ theme: ThemePreference; fontSize: FontSizePreference }>()
  const [error, setError] = useState('')
  useEffect(() => {
    let stale = false
    void readState<{ theme: ThemePreference; fontSize?: FontSizePreference }>('appearance', async () => ({ theme: 'system' }))
      .then((saved) => {
        if (!['light', 'dark', 'system'].includes(saved.theme)) throw new Error('外观配置格式不受支持')
        if (saved.fontSize !== undefined && saved.fontSize !== 'small' && saved.fontSize !== 'standard' && saved.fontSize !== 'large') throw new Error('界面字号配置格式不受支持')
        if (!stale) {
          setPreference(saved.theme)
          setFontSizePreference(saved.fontSize ?? 'standard')
          setReady(true)
        }
      })
      .catch((reason) => {
        if (!stale) setError(reason instanceof Error ? reason.message : '外观配置读取失败')
      })
    return () => {
      stale = true
    }
  }, [])
  useEffect(() => {
    if (!ready) return
    let stale = false
    void writeState('appearance', { theme: preference, fontSize: fontSizePreference })
      .then(() => {
        if (!stale) {
          setError('')
          setSavedPreference({ theme: preference, fontSize: fontSizePreference })
        }
      })
      .catch((reason) => {
        if (!stale) setError(reason instanceof Error ? reason.message : '外观配置保存失败')
      })
    return () => {
      stale = true
    }
  }, [ready, preference, fontSizePreference])
  const systemDark = useSyncExternalStore(subscribeTheme, getSystemTheme)
  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode, preference])

  return {
    preference,
    setPreference,
    fontSizePreference,
    setFontSizePreference,
    mode,
    error,
    ready,
    saving: ready && (savedPreference?.theme !== preference || savedPreference?.fontSize !== fontSizePreference) && !error
  }
}
