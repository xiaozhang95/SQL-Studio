import dayjs from 'dayjs'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

import 'dayjs/locale/zh-cn'

import { readState, writeState } from '@/services/userState'
import type { AppearanceSettings } from '@/typings/theme'

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const subscribeTheme = (listener: () => void) => {
  systemTheme.addEventListener('change', listener)
  return () => systemTheme.removeEventListener('change', listener)
}
const getSystemTheme = () => systemTheme.matches
const defaults = { theme: 'system', fontSize: 'standard', language: 'zh-CN' } satisfies AppearanceSettings

function isAppearance(value: unknown): value is AppearanceSettings {
  if (!value || typeof value !== 'object') return false
  const saved = value as Partial<AppearanceSettings>
  return (
    (saved.theme === 'light' || saved.theme === 'dark' || saved.theme === 'system') &&
    (saved.fontSize === 'small' || saved.fontSize === 'standard' || saved.fontSize === 'large') &&
    (saved.language === 'zh-CN' || saved.language === 'en-US')
  )
}

/** 统一保存用户偏好，并在首帧绘制前同步主题，避免闪烁。 */
export const useThemePreference = () => {
  const [{ theme: preference, fontSize: fontSizePreference, language }, setAppearance] = useState<AppearanceSettings>(defaults)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const savePending = useRef(false)
  useEffect(() => {
    let stale = false
    void readState<unknown>('appearance', async () => defaults)
      .then((saved) => {
        if (!stale && isAppearance(saved)) setAppearance(saved)
      })
      .catch(() => {})
      .finally(() => {
        if (!stale) setReady(true)
      })
    return () => {
      stale = true
    }
  }, [])
  const savePreferences = async (settings: AppearanceSettings) => {
    if (!ready || savePending.current) return false
    savePending.current = true
    setSaving(true)
    try {
      await readState<unknown>('appearance', async () => defaults)
      const result = await writeState('appearance', settings)
      setAppearance(result.saved ? settings : isAppearance(result.data) ? result.data : defaults)
      return true
    } catch {
      return false
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
  useLayoutEffect(() => {
    document.documentElement.lang = language
    dayjs.locale(language === 'zh-CN' ? 'zh-cn' : 'en')
  }, [language])

  return {
    preference,
    fontSizePreference,
    language,
    savePreferences,
    mode,
    ready,
    saving
  }
}
