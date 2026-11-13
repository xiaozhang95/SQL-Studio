export function isAppURL(target, origin) {
  try {
    const url = new URL(target)
    return url.origin === origin && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

export function backendEnvironment(parent, runtime, state, address) {
  // 避免继承开发终端的初始密码、旧数据目录或数据库范围配置。
  const env = Object.fromEntries(Object.entries(parent).filter(([key]) => !key.toUpperCase().startsWith('SQLDESK_')))
  return { ...env, SQLDESK_ADDR: address, SQLDESK_STATE_DIR: state, SQLDESK_DATA_DIR: state, SQLDESK_WEB_DIR: runtime }
}

export function allowsFileSystemPermission(permission, requestingOrigin, origin) {
  return permission === 'fileSystem' && origin !== '' && requestingOrigin === origin
}

export function validTitleBarTheme(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.background) &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.foreground) &&
    (value.mode === 'light' || value.mode === 'dark')
  )
}
