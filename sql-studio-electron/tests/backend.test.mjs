import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

import { startBackend, waitForService } from '../src/backend.mjs'
import { backendEnvironment, isAppURL, validTitleBarTheme } from '../src/policy.mjs'

test('标题栏仅接受十六进制主题颜色和明确的亮暗模式', () => {
  assert.equal(validTitleBarTheme({ background: '#141414', foreground: '#ffffff', mode: 'dark' }), true)
  assert.equal(validTitleBarTheme({ background: '#ffffff', foreground: '#000000', mode: 'light' }), true)
  assert.equal(validTitleBarTheme({ background: '#fff', foreground: '#000', mode: 'light' }), true)
  for (const value of [
    null,
    {},
    { background: 'url(file:///tmp/a)', foreground: '#ffffff', mode: 'dark' },
    { background: '#ffffff', foreground: '#000000', mode: 'system' }
  ]) {
    assert.equal(validTitleBarTheme(value), false)
  }
})

test('只允许工作台同源导航，拒绝外部页面和特殊协议', () => {
  const origin = 'http://127.0.0.1:12345'
  assert.equal(isAppURL(`${origin}/`, origin), true)
  assert.equal(isAppURL(`${origin}/agent`, origin), true)
  for (const url of ['https://example.com', 'javascript:alert(1)', 'file:///tmp/a', 'http://127.0.0.1:12346', 'http://user@127.0.0.1:12345', 'invalid']) {
    assert.equal(isAppURL(url, origin), false, url)
  }
})

test('桌面子进程隔离继承的 SQLDESK 配置和初始密码', () => {
  const env = backendEnvironment(
    { PATH: '/bin', SQLDESK_MYSQL_PASSWORD: 'secret', SQLDESK_STATE_DIR: '/old', sqldesk_data_dir: '/old' },
    '/runtime/web',
    '/desktop/state',
    '127.0.0.1:12345'
  )
  assert.deepEqual(env, {
    PATH: '/bin',
    SQLDESK_ADDR: '127.0.0.1:12345',
    SQLDESK_WEB_DIR: '/runtime/web',
    SQLDESK_STATE_DIR: '/desktop/state',
    SQLDESK_DATA_DIR: '/desktop/state'
  })
})

test('健康检查遵守现有 Go API 契约并等待服务就绪', async (t) => {
  let calls = 0
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/api/health')
    calls += 1
    res.writeHead(calls === 1 ? 503 : 200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(calls === 1 ? { status: 'starting' } : { status: 'ok', service: 'SQL Studio', framework: 'gin' }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  await waitForService(`http://127.0.0.1:${server.address().port}`, { timeout: 2000 })
  assert.ok(calls >= 2)
})

test('子进程退出时停止等待，不继续接入其他服务', async () => {
  await assert.rejects(waitForService('http://127.0.0.1:1', { stopped: () => true }), /已退出/)
})

test('无服务时给出有界超时', async () => {
  await assert.rejects(waitForService('http://127.0.0.1:1', { timeout: 100 }), /超时/)
})

test('关闭启动窗口可中断正在等待的健康请求', async (t) => {
  const server = http.createServer(() => {})
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const controller = new AbortController()
  const waiting = waitForService(`http://127.0.0.1:${server.address().port}`, { signal: controller.signal })
  controller.abort()
  await assert.rejects(waiting, { name: 'AbortError' })
})

test(
  '启动取消会结束未就绪的子进程，不遗留后台服务',
  { skip: process.platform === 'win32' ? 'POSIX 可执行文件替身；Windows 仍运行健康请求取消测试' : false },
  async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sql-studio-startup-'))
    t.after(() => rm(directory, { recursive: true, force: true }))
    await writeFile(
      path.join(directory, 'sql-studio-backend'),
      `#!/usr/bin/env node\nconst fs = require('node:fs'); fs.writeFileSync('pid', String(process.pid)); process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000);\n`,
      { mode: 0o755 }
    )
    const controller = new AbortController()
    const result = startBackend(directory, directory, () => assert.fail('启动取消不应被当作服务意外退出'), { signal: controller.signal })
    // 立即挂接 rejection handler，避免取消和测试断言之间出现未处理的拒绝。
    const rejected = assert.rejects(result, /abort/i)
    t.after(async () => {
      controller.abort()
      await rejected
    })
    let pid
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        pid = Number(await readFile(path.join(directory, 'pid'), 'utf8'))
        break
      } catch {
        await delay(20)
      }
    }
    assert.ok(pid, '替身进程应已启动')
    controller.abort()
    await rejected
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
  }
)
