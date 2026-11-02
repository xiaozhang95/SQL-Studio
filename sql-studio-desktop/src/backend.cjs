const { spawn } = require('node:child_process')
const { mkdir } = require('node:fs/promises')
const net = require('node:net')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')

function backendEnvironment(environment, stateDir, port) {
  const env = Object.fromEntries(Object.entries(environment).filter(([key]) => !key.toUpperCase().startsWith('SQLDESK_')))
  return { ...env, SQLDESK_ADDR: `127.0.0.1:${port}`, SQLDESK_STATE_DIR: stateDir, SQLDESK_DATA_DIR: stateDir }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

async function startBackend({ binary, dataDir, signal, onExit, timeout = 20000 }) {
  const stateDir = path.join(dataDir, 'state')
  await mkdir(stateDir, { recursive: true })
  signal?.throwIfAborted()
  const port = await freePort()
  signal?.throwIfAborted()
  const origin = `http://127.0.0.1:${port}`
  const child = spawn(binary, [], { cwd: dataDir, env: backendEnvironment(process.env, stateDir, port), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let stopped = false, ready = false, failure, startupLog = ''
  const exited = new Promise((resolve) => {
    child.once('error', (error) => { failure = error; resolve() })
    child.once('exit', (code, exitSignal) => {
      failure = new Error(`内置后端已退出（${code ?? exitSignal}）。${startupLog ? '\n' + startupLog : ''}`)
      if (ready && !stopped) onExit?.(failure)
      resolve()
    })
  })
  // A GUI process may inherit a console pipe that disappears when its launcher exits.
  // Drain backend output locally instead of writing to a possibly closed stdout/stderr.
  const collect = (chunk) => { startupLog = (startupLog + chunk.toString()).slice(-8000) }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  async function stop() {
    if (stopped) return exited
    stopped = true
    if (failure) return exited
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000)
    timer.unref()
    await exited
    clearTimeout(timer)
  }
  try {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      signal?.throwIfAborted()
      if (failure) throw failure
      try {
        const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(700) })
        const health = await response.json()
        if (response.ok && health.service === 'SQL Studio' && health.status === 'ok') {
          if (failure) throw failure
          ready = true
          return { origin, pid: child.pid, stop }
        }
      } catch (error) {
        if (failure) throw failure
      }
      await delay(100, undefined, { signal })
    }
    throw new Error('内置后端启动超时，请检查用户配置目录是否可写。')
  } catch (error) {
    await stop()
    throw error
  }
}

module.exports = { backendEnvironment, freePort, startBackend }
