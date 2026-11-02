const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const net = require('node:net')
const path = require('node:path')
const test = require('node:test')
const { backendEnvironment, freePort, startBackend } = require('../src/backend.cjs')

test('desktop backend isolates state and removes inherited service overrides and credentials', () => {
  const source = { PATH: 'system', SQLDESK_MYSQL_PASSWORD: 'must-not-seed', SQLDESK_WEB_DIR: 'stale-dist', sqldesk_state_dir: 'wrong', SQLDESK_ADDR: '0.0.0.0:8080' }
  const env = backendEnvironment(source, 'C:/test/state', 18090)
  assert.equal(env.PATH, 'system')
  assert.equal(env.SQLDESK_MYSQL_PASSWORD, undefined)
  assert.equal(env.SQLDESK_WEB_DIR, undefined)
  assert.equal(env.sqldesk_state_dir, undefined)
  assert.equal(env.SQLDESK_ADDR, '127.0.0.1:18090')
  assert.equal(env.SQLDESK_STATE_DIR, env.SQLDESK_DATA_DIR)
  assert.equal(source.SQLDESK_MYSQL_PASSWORD, 'must-not-seed')
})

test('desktop selects a loopback port without claiming the browser service port', async () => {
  const port = await freePort()
  assert.ok(port > 0)
  const probe = net.createServer()
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve) })
  await new Promise((resolve) => probe.close(resolve))
})

test('embedded backend starts, persists across restarts and stops only its own process', { timeout: 30000 }, async () => {
  const binary = path.resolve(__dirname, '../runtime/backend/sql-studio-backend.exe')
  await fs.access(binary)
  const dataDir = await fs.mkdtemp(path.resolve(__dirname, '../runtime/lifecycle-'))
  let service
  try {
    service = await startBackend({ binary, dataDir })
    let response = await fetch(service.origin + '/api/connections')
    assert.deepEqual(await response.json(), [])
    response = await fetch(service.origin + '/api/state/appearance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: 0, data: { theme: 'dark' } }) })
    assert.equal(response.status, 200)
    const first = service.origin
    await service.stop()
    await assert.rejects(fetch(first + '/api/health'))
    service = await startBackend({ binary, dataDir })
    response = await fetch(service.origin + '/api/state/appearance')
    assert.equal((await response.json()).data.theme, 'dark')
    await service.stop()
    await service.stop()
    await assert.rejects(startBackend({ binary: path.join(dataDir, 'missing.exe'), dataDir }), /ENOENT/)
  } finally {
    await service?.stop()
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})
