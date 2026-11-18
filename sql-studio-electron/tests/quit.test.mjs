import assert from 'node:assert/strict'
import test from 'node:test'

import { createQuitGuard } from '../src/quit.mjs'

test('原生关闭保持窗口存活，重复请求共享确认，取消后不停止后端', async () => {
  const ids = [],
    stopped = []
  const guard = createQuitGuard({ send: (id) => ids.push(id), shutdown: async () => stopped.push(true), confirmForce: async () => false })
  guard.setReady(true)
  const first = guard.request()
  assert.equal(guard.request(), first)
  assert.equal(ids.length, 1)
  guard.received(ids[0])
  guard.respond('stale', true)
  assert.deepEqual(stopped, [])
  guard.respond(ids[0], false)
  assert.equal(await first, false)
  assert.deepEqual(stopped, [])
  const second = guard.request()
  guard.respond(ids[0], true)
  guard.respond(ids[1], true)
  assert.equal(await second, true)
  assert.equal(stopped.length, 1)
})

test('退出完成回执先于后端停止，更新安装回调只在同意退出后传递', async () => {
  let id, stopDone
  const events = []
  const callback = () => events.push('install')
  const guard = createQuitGuard({
    send: (value) => {
      id = value
      events.push('prepare')
    },
    shutdown: (after) =>
      new Promise((resolve) => {
        events.push('stop')
        stopDone = () => {
          after()
          resolve()
        }
      }),
    confirmForce: async () => false
  })
  guard.setReady(true)
  const task = guard.request(callback)
  assert.deepEqual(events, ['prepare'])
  guard.respond(id, true)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(events, ['prepare', 'stop'])
  stopDone()
  assert.equal(await task, true)
  assert.deepEqual(events, ['prepare', 'stop', 'install'])
})

test('已收到的退出请求等待用户决定，不把确认弹窗等待时间当作无响应', async () => {
  let id,
    forced = 0
  const guard = createQuitGuard({
    send: (value) => {
      id = value
    },
    shutdown: async () => {},
    confirmForce: async () => {
      forced++
      return true
    },
    timeout: 10
  })
  guard.setReady(true)
  const task = guard.request()
  guard.received(id)
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(forced, 0)
  guard.respond(id, false)
  assert.equal(await task, false)
})

test('未收到退出请求、崩溃或重载时不接受迟到回执，强制退出由明确决定控制', async () => {
  let id,
    forced = 0,
    stopped = 0
  const guard = createQuitGuard({
    send: (value) => {
      id = value
    },
    shutdown: async () => {
      stopped++
    },
    confirmForce: async () => {
      forced++
      return false
    },
    timeout: 5
  })
  guard.setReady(true)
  assert.equal(await guard.request(), false)
  assert.equal(forced, 1)
  assert.equal(guard.received(id), false, 'expired requests cannot start renderer cleanup')
  guard.respond(id, true)
  assert.equal(stopped, 0)
  const task = guard.request()
  guard.reset()
  assert.equal(await task, false)
  guard.respond(id, true)
  assert.equal(stopped, 0)
  assert.equal(await guard.request(), false)
  assert.equal(forced, 2)
})

test('开屏尚未挂载工作台时可以取消启动并收尾', async () => {
  let stopped = 0
  const guard = createQuitGuard({
    send: () => assert.fail('not initialized'),
    shutdown: async () => {
      stopped++
    },
    confirmForce: async () => assert.fail('no edited workbench')
  })
  assert.equal(await guard.request(), true)
  assert.equal(stopped, 1)
})
