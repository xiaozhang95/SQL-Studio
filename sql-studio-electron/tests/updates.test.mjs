import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import test from 'node:test'

import semver from 'semver'

const installer = 'SQL-Studio-Setup-1.0.1-x64.exe'
const matchingUpdate = {
  updateInfo: {
    version: '1.0.1',
    files: [{ url: installer, sha512: 'fixture-checksum' }]
  }
}

function fixture({ installed = true, response = () => new Response(JSON.stringify({ tag_name: '1.0.1' })), manifest = async () => matchingUpdate, download = async () => {} } = {}) {
  const requests = [],
    logs = [],
    events = []
  const updater = Object.assign(new EventEmitter(), {
    checkForUpdates: async () => {
      events.push('manifest')
      return manifest()
    },
    downloadUpdate: async () => {
      events.push('download')
      return download()
    },
    quitAndInstall: (...args) => events.push(['install', ...args])
  })
  const app = { isPackaged: true, getVersion: () => '1.0.0', quit() {} }
  const net = {
    fetch: async (...args) => {
      requests.push(args)
      return response(...args)
    }
  }
  const shell = { openExternal: async (url) => events.push(['open', url]) }
  const source = readFileSync(new URL('../src/updates.mjs', import.meta.url), 'utf8')
    .replace(/^import .+\r?\n/gm, '')
    .replace(/export function /g, 'function ')
    .replaceAll('import.meta.url', JSON.stringify(import.meta.url))
  const loaded = new Function('existsSync', 'createRequire', 'path', 'app', 'net', 'shell', 'electronUpdater', 'semver', 'process', source + '\nreturn {createDesktopUpdates, desktopUpdateErrorCode}')(
    () => installed,
    () => () => ({ version: '1.0.0' }),
    path,
    app,
    net,
    shell,
    {
      NsisUpdater: function () {
        return updater
      }
    },
    semver,
    { platform: 'win32', arch: 'x64', resourcesPath: 'fixture-resources' }
  )
  return {
    ...loaded,
    updates: loaded.createDesktopUpdates((message) => logs.push(message)),
    requests,
    logs,
    events,
    updater
  }
}

test('检查仅访问公开发行页 JSON，验证版本并检查安装清单', async () => {
  const f = fixture()
  assert.deepEqual(await f.updates.check(), {
    status: 'available',
    version: '1.0.1',
    canDownload: true
  })
  assert.equal(f.requests[0][0], 'https://github.com/xiaozhang95/SQL-Studio/releases/latest')
  assert.equal(f.requests[0][1].headers.Accept, 'application/json')
  assert.equal(f.requests[0][1].headers['User-Agent'], 'SQL-Studio/1.0.0')
  assert.equal(f.requests[0][1].cache, 'no-store')
  assert.equal(
    f.requests.some(([url]) => url.includes('api.github.com')),
    false
  )
  assert.equal(f.updater.autoDownload, false)
  assert.equal(f.updater.autoInstallOnAppQuit, false)
})

test('同版本直接返回最新，绿色版发现新版本仅提供手动下载', async () => {
  const current = fixture({
    response: () => new Response(JSON.stringify({ tag_name: 'v1.0.0' }))
  })
  assert.deepEqual(await current.updates.check(), { status: 'upToDate' })
  assert.deepEqual(current.events, [])
  const portable = fixture({ installed: false })
  assert.deepEqual(await portable.updates.check(), {
    status: 'available',
    version: '1.0.1',
    canDownload: false
  })
  assert.deepEqual(portable.events, [])
})

test('公开发行页的正常 HTTP 跳转仍能读取版本信息', async (t) => {
  const routes = []
  const server = http.createServer((request, response) => {
    routes.push(request.url)
    if (request.url === '/latest') {
      response.writeHead(302, { Location: '/tag/1.0.1' })
      response.end()
    } else {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ tag_name: '1.0.1' }))
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const f = fixture({ installed: false, response: (_url, options) => fetch(`http://127.0.0.1:${server.address().port}/latest`, options) })
  assert.deepEqual(await f.updates.check(), { status: 'available', version: '1.0.1', canDownload: false })
  assert.deepEqual(routes, ['/latest', '/tag/1.0.1'])
})

test('清单缺失或架构不符不掩盖公开的新版本', async () => {
  for (const manifest of [
    async () => {
      throw new Error('missing latest.yml')
    },
    async () => ({
      updateInfo: {
        version: '1.0.1',
        files: [{ url: 'other-arm64.exe', sha512: 'fixture' }]
      }
    })
  ]) {
    const f = fixture({ manifest })
    assert.deepEqual(await f.updates.check(), {
      status: 'available',
      version: '1.0.1',
      canDownload: false
    })
    await f.updates.openRelease()
    assert.deepEqual(f.events.at(-1), ['open', 'https://github.com/xiaozhang95/SQL-Studio/releases/tag/1.0.1'])
  }
})

test('限流、拒绝访问、未发布和服务故障分别返回安全错误码', async () => {
  for (const [status, headers, code] of [
    [403, { 'x-ratelimit-remaining': '0' }, 'UPDATE_RATE_LIMITED'],
    [429, {}, 'UPDATE_RATE_LIMITED'],
    [403, {}, 'UPDATE_FORBIDDEN'],
    [404, {}, 'UPDATE_NO_RELEASE'],
    [503, {}, 'UPDATE_SERVER_ERROR']
  ]) {
    const f = fixture({
      response: () => new Response('private upstream detail', { status, headers })
    })
    await assert.rejects(f.updates.check(), (error) => f.desktopUpdateErrorCode(error) === code && !error.message.includes('private'))
  }
})

test('超时、网络异常、非法版本和非 JSON 响应保留明确分类', async () => {
  for (const [response, code] of [
    [
      () => {
        throw new DOMException('timed out', 'TimeoutError')
      },
      'UPDATE_TIMEOUT'
    ],
    [
      () => {
        throw new Error('net::ERR_TIMED_OUT')
      },
      'UPDATE_TIMEOUT'
    ],
    [
      () => {
        throw new Error('net::ERR_PROXY_CONNECTION_FAILED')
      },
      'UPDATE_NETWORK'
    ],
    [() => new Response('<html>blocked</html>'), 'UPDATE_INVALID_RESPONSE'],
    [() => new Response(JSON.stringify({ tag_name: 'not-a-version' })), 'UPDATE_INVALID_RESPONSE'],
    [() => new Response(JSON.stringify({ tag_name: '2.0.0-beta.1' })), 'UPDATE_INVALID_RESPONSE'],
    [() => new Response(JSON.stringify({ tag_name: '2.0.0', prerelease: true })), 'UPDATE_INVALID_RESPONSE']
  ]) {
    const f = fixture({ response })
    await assert.rejects(f.updates.check(), (error) => f.desktopUpdateErrorCode(error) === code)
    if (code === 'UPDATE_NETWORK') assert.ok(f.logs.some((message) => message.includes('net::ERR_PROXY_CONNECTION_FAILED')))
  }
})

test('下载再次校验清单，匹配成功后才能经退出收尾调用安装', async () => {
  const f = fixture()
  await f.updates.check()
  assert.deepEqual(await f.updates.download(), {
    status: 'downloaded',
    version: '1.0.1'
  })
  await f.updates.install(async (callback) => {
    f.events.push('shutdown')
    callback()
  })
  assert.deepEqual(f.events.at(-2), 'shutdown')
  assert.deepEqual(f.events.at(-1), ['install', false, true])
  let reads = 0
  const changed = fixture({
    manifest: async () => (++reads === 1 ? matchingUpdate : { updateInfo: { version: '1.0.2', files: [] } })
  })
  await changed.updates.check()
  await assert.rejects(changed.updates.download(), (error) => changed.desktopUpdateErrorCode(error) === 'UPDATE_MANIFEST_MISMATCH')
  assert.equal(changed.events.includes('download'), false)
})

test('重复检查共享一个请求，失败不会让检查状态永久占用', async () => {
  let finish
  const f = fixture({
    response: () =>
      new Promise((resolve) => {
        finish = resolve
      })
  })
  const first = f.updates.check()
  assert.equal(f.updates.check(), first)
  assert.equal(f.requests.length, 1)
  finish(new Response('denied', { status: 403 }))
  await assert.rejects(first)
  const retry = f.updates.check()
  assert.notEqual(retry, first)
  finish(new Response(JSON.stringify({ tag_name: '1.0.1' })))
  await retry
})

test('preload 解包桌面更新结果，错误仅携带安全码，控制台桥接保持原接口', async () => {
  let bridge,
    reply = { ok: true, value: { status: 'upToDate' } }
  const source = readFileSync(new URL('../src/preload.cjs', import.meta.url), 'utf8')
  new Function('require', 'process', source)(
    () => ({
      contextBridge: {
        exposeInMainWorld: (_name, value) => {
          bridge = value
        }
      },
      ipcRenderer: {
        invoke: async (channel) => (channel === 'sql-studio:open-console' ? undefined : reply)
      }
    }),
    { platform: 'win32' }
  )
  assert.deepEqual(await bridge.updates.check(), { status: 'upToDate' })
  reply = { ok: false, errorCode: 'UPDATE_RATE_LIMITED' }
  await assert.rejects(bridge.updates.check(), {
    message: 'UPDATE_RATE_LIMITED'
  })
  assert.equal(await bridge.openConsole(), undefined)
})

test('下载进度广播真实字节和速度，校验完成前保持下载状态，重开可恢复快照', async () => {
  let finish, started
  const downloading = new Promise((resolve) => {
    started = resolve
  })
  const f = fixture({
    download: () =>
      new Promise((resolve) => {
        finish = resolve
        started()
      })
  })
  const states = []
  const unsubscribe = f.updates.subscribe((state) => states.push(state))
  await f.updates.check()
  const task = f.updates.download()
  await downloading
  assert.equal(f.updates.download(), task)
  f.updater.emit('download-progress', { percent: 37.5, transferred: 30, total: 80, bytesPerSecond: 10 })
  assert.deepEqual(f.updates.getState().progress, { percent: 37.5, transferred: 30, total: 80, bytesPerSecond: 10 })
  const latest = f.updates.getState()
  assert.equal(latest.pending, 'download')
  assert.equal(latest.result.status, 'available')
  latest.progress.percent = 99
  assert.equal(f.updates.getState().progress.percent, 37.5, '返回的快照不能改写主进程状态')
  f.updater.emit('download-progress', { percent: 100, transferred: 80, total: 80, bytesPerSecond: 10 })
  assert.equal(f.updates.getState().pending, 'download', '字节传输完成不代表校验成功')
  assert.equal(f.updates.getState().result.status, 'available')
  const count = states.length
  unsubscribe()
  finish()
  await task
  assert.equal(states.length, count)
  assert.equal(f.updates.getState().pending, undefined)
  assert.equal(f.updates.getState().result.status, 'downloaded')
  assert.equal(f.updates.getState().progress.percent, 100)
  assert.ok(states.every((state, index) => index === 0 || state.revision > states[index - 1].revision))
})

test('下载失败保留进度和安全错误码，重试清零且忽略任务结束后的进度', async () => {
  let attempts = 0
  const f = fixture({
    download: async () => {
      attempts++
      f.updater.emit('download-progress', { percent: 120, transferred: 100, total: 80, bytesPerSecond: -5 })
      if (attempts === 1) throw new Error('net::ERR_CONNECTION_RESET')
    }
  })
  await f.updates.check()
  await assert.rejects(f.updates.download())
  assert.deepEqual(f.updates.getState().error, { action: 'download', code: 'UPDATE_NETWORK' })
  assert.deepEqual(f.updates.getState().progress, { percent: 100, transferred: 80, total: 80, bytesPerSecond: 0 })
  const failed = f.updates.getState()
  f.updater.emit('download-progress', { percent: 1 })
  assert.deepEqual(f.updates.getState(), failed)
  const retry = f.updates.download()
  assert.equal(f.updates.getState().error, undefined)
  assert.equal(f.updates.getState().progress.percent, 0)
  await retry
  assert.equal(f.updates.getState().result.status, 'downloaded')
})

test('preload 更新状态订阅只转发快照，注销移除同一监听器', async () => {
  let bridge
  const ipc = new EventEmitter()
  ipc.invoke = async (channel) => {
    assert.equal(channel, 'sql-studio:get-update-state')
    return { ok: true, value: { revision: 2, pending: 'download' } }
  }
  new Function('require', 'process', readFileSync(new URL('../src/preload.cjs', import.meta.url), 'utf8'))(
    () => ({
      contextBridge: {
        exposeInMainWorld: (_name, value) => {
          bridge = value
        }
      },
      ipcRenderer: ipc
    }),
    { platform: 'win32' }
  )
  const received = []
  const stop = bridge.updates.onState((...args) => received.push(args))
  const snapshot = await bridge.updates.getState()
  ipc.emit('sql-studio:updates-changed', { privateEvent: true }, snapshot)
  assert.deepEqual(received, [[snapshot]])
  stop()
  assert.equal(ipc.listenerCount('sql-studio:updates-changed'), 0)
})
