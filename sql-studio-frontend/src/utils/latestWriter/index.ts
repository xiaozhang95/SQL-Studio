/** One in-flight write plus the latest waiting value; superseded callers settle with it. */
export function createLatestWriter<T>(write: (value: T) => Promise<void>) {
  type Pending = { value: T; callers: { resolve: () => void; reject: (error: unknown) => void }[] }
  let active = false
  let pending: Pending | undefined
  function rejectPending(error: unknown) {
    pending?.callers.forEach(({ reject }) => reject(error))
    pending = undefined
  }
  async function drain() {
    if (active) return
    active = true
    try {
      while (pending) {
        const current = pending
        pending = undefined
        try {
          await write(current.value)
          current.callers.forEach(({ resolve }) => resolve())
        } catch (error) {
          current.callers.forEach(({ reject }) => reject(error))
          // A conflict must not silently retry queued snapshots against another window.
          rejectPending(error)
          break
        }
      }
    } finally {
      active = false
    }
  }
  return (value: T) =>
    new Promise<void>((resolve, reject) => {
      if (pending) {
        pending.value = value
        pending.callers.push({ resolve, reject })
      } else pending = { value, callers: [{ resolve, reject }] }
      void drain()
    })
}
