import { randomUUID } from 'node:crypto'

/** Keep the renderer alive until its confirmation, durable save and connection cleanup finish. */
export function createQuitGuard({ send, shutdown, confirmForce, timeout = 5000 }) {
  let ready = false
  let initialized = false
  let pending
  let task
  function settle(allowed) {
    if (!pending) return
    clearTimeout(pending.timer)
    const resolve = pending.resolve
    pending = undefined
    resolve(allowed)
  }
  return {
    setReady(value) {
      ready = value === true
      if (ready) initialized = true
      else settle(false)
    },
    received(id) {
      if (pending?.id !== id) return false
      clearTimeout(pending.timer)
      return true
    },
    respond(id, allowed) {
      if (pending?.id === id && typeof allowed === 'boolean') settle(allowed)
    },
    reset() {
      ready = false
      settle(false)
    },
    request(afterStop) {
      if (task) return task
      task = (async () => {
        let allowed
        if (!initialized) allowed = true
        else if (!ready) allowed = await confirmForce()
        else {
          allowed = await new Promise((resolve) => {
            const id = randomUUID()
            pending = { id, resolve, timer: setTimeout(() => settle(null), timeout) }
            try {
              send(id)
            } catch {
              settle(null)
            }
          })
          if (allowed === null) allowed = await confirmForce()
        }
        if (allowed) await shutdown(afterStop)
        return Boolean(allowed)
      })().finally(() => {
        task = undefined
      })
      return task
    }
  }
}
