import { useState } from 'react'

import type { RedisKey, RedisKeyChange, RedisKeyDetail } from '@/services/redis'

const maximumTTL = 315360000
export function useKeyEditor(key: RedisKey, detail: RedisKeyDetail, ttlMillis: number, onSave: (change: RedisKeyChange) => Promise<void>, clearError: () => void) {
  const initialName = detail.name ?? key.name
  const [name, setName] = useState(initialName)
  const [value, setValue] = useState(detail.preview)
  const [ttlDraft, setTTLDraft] = useState<{ value: number | null }>()
  const ttl = ttlDraft ? ttlDraft.value : 0
  const remainingSeconds = ttlMillis < 0 ? undefined : Math.max(0, Math.ceil(ttlMillis / 1000))
  const ttlChanged = ttlDraft !== undefined
  const ttlInvalid = ttlChanged && (ttl === null || !Number.isInteger(ttl) || ttl < 0 || ttl > maximumTTL)
  const nameChanged = detail.name !== undefined && name !== initialName
  const valueChanged = detail.editable && value !== detail.preview
  const dirty = nameChanged || valueChanged || ttlChanged

  const changeName = (next: string) => {
    setName(next)
    clearError()
  }
  const changeValue = (next: string) => {
    setValue(next)
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
    changeName,
    changeValue,
    changeTTL,
    cancel,
    save
  }
}
