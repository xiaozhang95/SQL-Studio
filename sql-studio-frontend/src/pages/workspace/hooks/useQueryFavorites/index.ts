import { useRef, useState } from 'react'

import { changeQueryFavorites, listQueryFavorites } from '@/services/queryFavorites'
import type { QueryFavorite } from '@/typings/workspace'

type Draft = Omit<QueryFavorite, 'id' | 'title'> & { id?: string; title?: string }

export function useQueryFavorites() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<QueryFavorite[]>([])
  const [draft, setDraft] = useState<Draft>()
  const [busy, setBusy] = useState<'read' | 'write'>()
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')
  const [deleting, setDeleting] = useState<string>()
  const [deleteError, setDeleteError] = useState('')
  const pending = useRef(false)

  async function run(action: () => Promise<QueryFavorite[]>, status: 'read' | 'write', onFailure: (message: string) => void) {
    if (pending.current) return false
    pending.current = true
    setBusy(status)
    onFailure('')
    try {
      setItems(await action())
      return true
    } catch (reason) {
      onFailure(reason instanceof Error ? reason.message : '查询收藏操作失败')
      return false
    } finally {
      pending.current = false
      setBusy(undefined)
    }
  }

  const reload = () => run(() => listQueryFavorites(true), 'read', setError)
  function show() {
    setOpen(true)
    void reload()
  }
  function close() {
    setOpen(false)
    setDeleting(undefined)
    setDeleteError('')
  }
  function edit(query: Draft) {
    if (!query.sql.trim()) return
    setEditError('')
    setDraft(query)
  }
  function closeEditor() {
    if (busy !== 'write') setDraft(undefined)
  }
  async function save(title: string) {
    const name = title.trim()
    if (!draft || !name) return
    const item: QueryFavorite = { ...draft, id: draft.id ?? crypto.randomUUID(), title: name }
    const saved = await run(
      () =>
        changeQueryFavorites((items) => {
          if (!draft.id) return [item, ...items]
          if (!items.some(({ id }) => id === draft.id)) throw new Error('此收藏已删除，请刷新列表')
          return items.map((entry) => (entry.id === draft.id ? { ...entry, title: name } : entry))
        }),
      'write',
      setEditError
    )
    if (saved) {
      setDraft(undefined)
      setError('')
    }
  }
  function setDeleteOpen(id: string, visible: boolean) {
    // 请求期间保留确认气泡，删除成功后由 remove 关闭。
    if (pending.current || (!visible && deleting !== id)) return
    setDeleting(visible ? id : undefined)
    setDeleteError('')
  }
  async function remove(id: string) {
    if (id !== deleting) return
    if (await run(() => changeQueryFavorites((items) => items.filter((item) => item.id !== id)), 'write', setDeleteError)) {
      setDeleting(undefined)
      setError('')
    }
  }

  return { busy, close, closeEditor, deleting, deleteError, draft, edit, editError, error, items, open, reload, remove, save, setDeleteOpen, show }
}
