import { randomUUID } from 'node:crypto'
import { open, rename, rm } from 'node:fs/promises'
import path from 'node:path'

const maxChunkBytes = 8 * 1024 * 1024
const maxOpenSaves = 4

/** One window owns the picker and its temporary files. Only a completed save replaces the destination. */
export function createSQLSaves(pickFile) {
  const saves = new Map()
  let picking = false
  let opening
  let generation = 0

  async function begin(filename, filterName) {
    if (typeof filename !== 'string' || !/^[^<>:"/\\|?*\x00-\x1f]{1,180}\.sql$/i.test(filename)) throw new Error('无效的 SQL 文件名')
    if (picking || saves.size >= maxOpenSaves) throw new Error('已有文件正在保存')
    picking = true
    const owner = generation
    try {
      const result = await pickFile({ defaultPath: filename, filters: [{ name: filterName === 'SQL file' ? filterName : 'SQL 文件', extensions: ['sql'] }] })
      if (result.canceled || !result.filePath || generation !== owner) return { canceled: true }
      const filePath = result.filePath
      if ([...saves.values()].some((save) => save.filePath === filePath)) throw new Error('该文件已有保存任务')
      opening = openTemporary(filePath, owner)
      return await opening
    } finally {
      opening = undefined
      picking = false
    }
  }

  async function openTemporary(filePath, owner) {
    const id = randomUUID()
    const temporary = path.join(path.dirname(filePath), `.sql-studio-save-${id}`)
    const file = await open(temporary, 'wx', 0o600)
    if (generation !== owner) {
      try {
        await file.close()
      } finally {
        await rm(temporary, { force: true })
      }
      return { canceled: true }
    }
    saves.set(id, { temporary, file, filePath, state: 'open', pending: Promise.resolve() })
    return { canceled: false, id, filePath }
  }

  function getOpen(id) {
    const save = saves.get(id)
    if (save?.state !== 'open') throw new Error('保存请求已结束')
    return save
  }

  async function append(id, bytes) {
    const save = getOpen(id)
    if (save.writing) throw new Error('请等待当前文件分块写入完成')
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > maxChunkBytes) throw new Error('无效的 SQL 文件分块')
    save.writing = true
    save.pending = save.file.writeFile(bytes)
    try {
      await save.pending
    } catch (error) {
      await discard(id)
      throw error
    } finally {
      save.writing = false
    }
  }

  function commit(id) {
    const save = getOpen(id)
    save.state = 'committing'
    save.finished = finish(save, true).finally(() => saves.delete(id))
    return save.finished
  }

  function discard(id) {
    const save = saves.get(id)
    if (!save) return Promise.resolve()
    if (save.state !== 'published') save.state = 'discarded'
    save.finished ??= finish(save, false).finally(() => saves.delete(id))
    return save.finished
  }

  async function finish(save, publish) {
    try {
      try {
        if (publish) {
          await save.pending
          await save.file.sync()
        } else {
          await save.pending.catch(() => {})
        }
      } finally {
        await save.file.close()
      }
      if (publish) {
        if (save.state === 'discarded') throw new Error('SQL 文件保存已取消')
        save.state = 'published'
        await rename(save.temporary, save.filePath)
      }
    } finally {
      await rm(save.temporary, { force: true })
    }
  }

  async function reset() {
    generation++
    await Promise.allSettled([opening, ...[...saves.keys()].map(discard)])
  }

  return { begin, append, commit, discard, reset }
}
