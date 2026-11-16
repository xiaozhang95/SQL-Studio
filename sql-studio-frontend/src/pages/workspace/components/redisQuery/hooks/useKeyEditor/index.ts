import { useEffect, useState } from 'react'

import type { RedisKey, RedisKeyChange, RedisKeyDetail } from '@/services/redis'

const maximumTTL = 315360000
type CopyTarget = 'name' | 'value'

export function useKeyEditor(key: RedisKey, detail: RedisKeyDetail, ttlMillis: number, onSave: (change: RedisKeyChange) => Promise<void>, clearError: () => void) {
  const initialName = detail.name ?? key.name
  const [name, setName] = useState(initialName)
  const [value, setValue] = useState(detail.preview)
  const [copied, setCopied] = useState<{ target: CopyTarget; text: string }>()
  const [copyError, setCopyError] = useState('')
  const [ttlDraft, setTTLDraft] = useState<{ value: number | null }>()
  const [initialTTL] = useState(() => (detail.ttlMillis < 0 ? 0 : Math.max(1, Math.ceil(detail.ttlMillis / 1000))))
  const ttl = ttlDraft ? ttlDraft.value : initialTTL
  const remainingSeconds = ttlMillis < 0 ? undefined : Math.max(0, Math.ceil(ttlMillis / 1000))
  const ttlChanged = ttlDraft !== undefined
  const ttlInvalid = ttlChanged && (ttl === null || !Number.isInteger(ttl) || ttl < 0 || ttl > maximumTTL)
  const nameChanged = detail.name !== undefined && name !== initialName
  const valueChanged = detail.editable && value !== detail.preview
  const dirty = nameChanged || valueChanged || ttlChanged

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(undefined), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async (target: CopyTarget) => {
    const text = target === 'name' ? name : value
    setCopyError('')
    try {
      await navigator.clipboard.writeText(text)
      setCopied({ target, text })
    } catch {
      setCopyError('复制失败，请选中文本后手动复制')
    }
  }

  const changeName = (next: string) => {
    setName(next)
    setCopyError('')
    clearError()
  }
  const changeValue = (next: string) => {
    setValue(next)
    setCopyError('')
    clearError()
  }
  const changeTTL = (next: number | null) => {
    setTTLDraft({ value: next })
    clearError()
  }
  const cancel = () => {
    setName(initialName)
    setValue(detail.preview)
    setTTLDraft(undefined)
    setCopied(undefined)
    setCopyError('')
    clearError()
  }
  const save = async () => {
    if (!dirty || ttlInvalid || ttl === null) return
    const expiration = ttlChanged ? { ttl } : {}
    if (valueChanged) await onSave({ action: 'value', valueType: detail.type, value, before: detail.preview, target: nameChanged ? name : undefined, ...expiration })
    else if (nameChanged) await onSave({ action: 'rename', target: name, ...expiration })
    else if (ttlChanged) await onSave({ action: 'ttl', ttl })
  }
  return {
    name,
    value,
    ttl,
    remainingSeconds,
    maximumTTL,
    ttlInvalid,
    dirty,
    copy,
    copyError,
    copiedName: copied?.target === 'name' && copied.text === name,
    copiedValue: copied?.target === 'value' && copied.text === value,
    changeName,
    changeValue,
    changeTTL,
    cancel,
    save
  }
}
