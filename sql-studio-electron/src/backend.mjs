import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { backendEnvironment } from './policy.mjs'

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return port
}

export async function waitForService(url, { timeout = 15000, stopped = () => false, signal } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    signal?.throwIfAborted()
    if (stopped()) throw new Error('本地服务已退出。')
    try {
      const response = await fetch(`${url}/api/health`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(700)]) : AbortSignal.timeout(700) })
      const body = await response.json()
      if (response.ok && body.status === 'ok' && body.service === 'SQL Studio' && !stopped()) return
    } catch {
      /* 启动过程中连接可能尚未建立。 */
    }
    await delay(100, undefined, { signal })
  }
  throw new Error(`等待 SQL Studio 服务超时：${url}`)
}

export async function startBackend(runtime, dataDirectory, onExit, { signal } = {}) {
  signal?.throwIfAborted()
  // 数据根与 Go 服务一致：状态在 <dataDirectory>/state，Electron 自身数据在 <dataDirectory>/electron。
  const stateDirectory = path.join(dataDirectory, 'state')
  await mkdir(stateDirectory, { recursive: true })
  const address = `127.0.0.1:${await freePort()}`
  signal?.throwIfAborted()
  const url = `http://${address}`
  const executable = path.join(runtime, process.platform === 'win32' ? 'sql-studio-backend.exe' : 'sql-studio-backend')
  const child = spawn(executable, [], {
    cwd: dataDirectory,
    env: backendEnvironment(process.env, path.join(runtime, 'web'), stateDirectory, address),
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe']
  })
  let stopped = false
  let stopping = false
  let ready = false
  let failure
  let diagnostics = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (data) => {
    diagnostics = (diagnostics + data).slice(-4000)
  })
  const exited = new Promise((resolve) => {
    child.once('error', (error) => {
      failure = error
      stopped = true
      resolve()
    })
    child.once('exit', () => {
      stopped = true
      resolve()
      if (ready && !stopping) onExit()
    })
  })
  let stopTask
  function stop() {
    stopTask ||= stopChild()
    return stopTask
  }
  async function stopChild() {
    stopping = true
    if (stopped) return
    child.kill('SIGTERM')
    // Go 最多等待在途请求 5 秒，超时后只终止自己创建的子进程。
    const graceful = await Promise.race([exited.then(() => true), delay(6000, false, { ref: false })])
    if (!graceful) {
      child.kill('SIGKILL')
      await exited
    }
  }
  const abort = () => {
    void stop()
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    await waitForService(url, { stopped: () => stopped, signal })
    // 健康检查后再次确认子进程仍在，端口竞争失败不能接管其他服务。
    await delay(100, undefined, { signal })
    if (stopped) throw failure || new Error('服务启动失败。')
    ready = true
    return { url, stop }
  } catch (error) {
    await stop()
    throw new Error(`${failure?.message || error.message}\n${diagnostics}`)
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}
