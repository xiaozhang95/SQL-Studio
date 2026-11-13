import assert from 'node:assert/strict'
import { test } from 'node:test'

import { allowsFileSystemPermission } from '../src/policy.mjs'

test('仅工作台本源的 fileSystem 权限放行，其余权限与来源一律拒绝', () => {
  const origin = 'http://127.0.0.1:18080'
  assert.equal(allowsFileSystemPermission('fileSystem', origin, origin), true)
  for (const permission of ['media', 'geolocation', 'notifications', 'clipboard-read', 'file-system', 'unknown']) {
    assert.equal(allowsFileSystemPermission(permission, origin, origin), false)
  }
  assert.equal(allowsFileSystemPermission('fileSystem', 'http://127.0.0.1:15173', origin), false)
  assert.equal(allowsFileSystemPermission('fileSystem', 'https://example.com', origin), false)
  assert.equal(allowsFileSystemPermission('fileSystem', '', origin), false)
  assert.equal(allowsFileSystemPermission('fileSystem', origin, ''), false)
})