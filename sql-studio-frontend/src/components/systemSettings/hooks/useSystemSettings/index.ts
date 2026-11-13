import { useRef, useState } from 'react'

import { useAISettings } from '@/hooks/useAISettings'
import type { AppearancePreferences } from '@/typings/theme'

import { SettingsSection } from '../../constant/settings'

/** 系统设置共用草稿与提交入口，切换页面保留输入。 */
export function useSystemSettings({ themePreference, fontSizePreference, language = 'zh-CN', onAppearanceSave, themeReady = true }: AppearancePreferences) {
  const ai = useAISettings()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SettingsSection>(SettingsSection.Model)
  const [draftTheme, setDraftTheme] = useState(themePreference)
  const [draftFontSize, setDraftFontSize] = useState(fontSizePreference)
  const [draftLanguage, setDraftLanguage] = useState(language)
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)
  const appearanceChanged = draftTheme !== themePreference || draftFontSize !== fontSizePreference || draftLanguage !== language
  const changed = appearanceChanged || ai.changed
  const busy = saving || ai.busy
  const canSave = themeReady && changed && !busy && (!ai.changed || ai.canSave)

  const show = () => {
    if (submitting.current || !themeReady) return
    setDraftTheme(themePreference)
    setDraftFontSize(fontSizePreference)
    setDraftLanguage(language)
    setSection(SettingsSection.Model)
    setOpen(true)
    void ai.show()
  }
  const close = () => {
    if (submitting.current) return
    ai.close()
    setOpen(false)
  }
  const save = async () => {
    if (submitting.current || !canSave) return
    submitting.current = true
    setSaving(true)
    try {
      if (ai.changed) {
        const saved = await ai.save()
        if (!saved) {
          setSection(SettingsSection.Model)
          return
        }
      }
      if (appearanceChanged && !(await onAppearanceSave({ theme: draftTheme, fontSize: draftFontSize, language: draftLanguage }))) return
      ai.close()
      setOpen(false)
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return { ai, open, section, setSection, draftTheme, setDraftTheme, draftFontSize, setDraftFontSize, draftLanguage, setDraftLanguage, busy, canSave, show, close, save }
}
