import { useRef, useState } from 'react'

import { useAISettings } from '@/hooks/useAISettings'
import type { AppearancePreferences } from '@/typings/theme'

import { SettingsSection } from '../../constant/settings'

/** 三个设置页共用草稿与提交入口，切换页面不会保存或丢失输入。 */
export function useSystemSettings({ themePreference, fontSizePreference, onAppearanceSave, themeReady = true }: AppearancePreferences) {
  const ai = useAISettings()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SettingsSection>(SettingsSection.Model)
  const [draftTheme, setDraftTheme] = useState(themePreference)
  const [draftFontSize, setDraftFontSize] = useState(fontSizePreference)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const appearanceChanged = draftTheme !== themePreference || draftFontSize !== fontSizePreference
  const changed = appearanceChanged || ai.changed
  const busy = saving || ai.busy
  const canSave = themeReady && changed && !busy && (!ai.changed || ai.canSave)

  const show = () => {
    if (submitting.current || !themeReady) return
    setDraftTheme(themePreference)
    setDraftFontSize(fontSizePreference)
    setError('')
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
    setError('')
    let modelSaved = false
    try {
      if (ai.changed) {
        const saved = await ai.save()
        if (!saved) {
          setSection(SettingsSection.Model)
          return
        }
        modelSaved = true
      }
      if (appearanceChanged) await onAppearanceSave({ theme: draftTheme, fontSize: draftFontSize })
      ai.close()
      setOpen(false)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '设置保存失败'
      setError(modelSaved ? `模型配置已保存，外观设置未保存：${message}` : message)
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return { ai, open, section, setSection, draftTheme, setDraftTheme, draftFontSize, setDraftFontSize, busy, canSave, error: error || ai.error, show, close, save }
}
