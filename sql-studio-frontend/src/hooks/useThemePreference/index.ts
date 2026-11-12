import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

import { readState, writeState } from '@/services/userState'
import type { AppearanceSettings, FontSizePreference, ThemePreference } from '@/typings/theme'

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
  const [saving, setSaving] = useState(false)
  const savePending = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let stale = false
    void readState<AppearanceSettings>('appearance', async () => ({ theme: 'system', fontSize: 'standard' }))
      .then((saved) => {
        if (!['light', 'dark', 'system'].includes(saved.theme)) throw new Error('外观配置格式不受支持')
        if (saved.fontSize !== 'small' && saved.fontSize !== 'standard' && saved.fontSize !== 'large') throw new Error('界面字号配置格式不受支持')
        if (!stale) {
          setPreference(saved.theme)
          setFontSizePreference(saved.fontSize)
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
  const savePreferences = async (settings: AppearanceSettings) => {
    if (!ready) throw new Error('外观配置尚未读取')
    if (savePending.current) throw new Error('外观配置正在保存')
    savePending.current = true
    setSaving(true)
    setError('')
    try {
      await writeState('appearance', settings)
      setPreference(settings.theme)
      setFontSizePreference(settings.fontSize)
    } catch (reason) {
      const cause = reason instanceof Error ? reason : new Error('外观配置保存失败')
      setError(cause.message)
      throw cause
    } finally {
      savePending.current = false
      setSaving(false)
    }
  }
  const systemDark = useSyncExternalStore(subscribeTheme, getSystemTheme)
  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode, preference])

  return {
    preference,
    fontSizePreference,
    savePreferences,
    mode,
    error,
    ready,
    saving
  }
}
