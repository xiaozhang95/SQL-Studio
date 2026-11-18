import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { app, net, shell } from 'electron'
import electronUpdater from 'electron-updater'
import semver from 'semver'

const releaseURL = 'https://github.com/xiaozhang95/SQL-Studio/releases'
const latestReleaseURL = `${releaseURL}/latest`

class UpdateError extends Error {
  constructor(code, cause) {
    super(code, cause ? { cause } : undefined)
    this.code = code
  }
}

/** Only stable public codes cross IPC; raw network and updater errors stay in the desktop log. */
export function desktopUpdateErrorCode(error) {
  if (error instanceof UpdateError) return error.code
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || /ERR_TIMED_OUT/.test(error?.message ?? '')) return 'UPDATE_TIMEOUT'
  if (/net::ERR_|fetch failed/i.test(error?.message ?? '')) return 'UPDATE_NETWORK'
  return 'UPDATE_FAILED'
}

function matchesRelease(update, version, installer) {
  const files = update?.updateInfo?.files
  return update?.updateInfo?.version === version && Array.isArray(files) && files.length === 1 && files[0]?.url === installer && typeof files[0]?.sha512 === 'string' && Boolean(files[0].sha512)
}

export function createDesktopUpdates(log) {
  const currentVersion = app.isPackaged ? app.getVersion() : createRequire(import.meta.url)('../../sql-studio-frontend/package.json').version
  const installed = app.isPackaged && process.platform === 'win32' && existsSync(path.join(process.resourcesPath, 'sql-studio-installed'))
  const updater = installed ? new electronUpdater.NsisUpdater() : undefined
  if (updater) {
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.disableDifferentialDownload = true
    updater.disableWebInstaller = true
    updater.allowPrerelease = false
    updater.on('error', (error) => log(`桌面更新失败: ${error.stack ?? error.message}`))
  }

  let release
  let downloadedVersion
  let checking
  let downloading
  let state = { revision: 0 }
  const listeners = new Set()
  const getState = () => structuredClone(state)
  const publish = (patch) => {
    state = { ...state, ...patch, revision: state.revision + 1 }
    for (const listener of listeners) {
      try {
        listener(getState())
      } catch (error) {
        log(`更新状态通知失败: ${error.message}`)
      }
    }
  }
  updater?.on('download-progress', (info) => {
    if (state.pending !== 'download') return
    const nonnegative = (value) => (Number.isFinite(value) ? Math.max(0, value) : 0)
    const total = nonnegative(info.total)
    publish({
      progress: {
        percent: Math.min(100, nonnegative(info.percent)),
        transferred: total > 0 ? Math.min(total, nonnegative(info.transferred)) : nonnegative(info.transferred),
        total,
        bytesPerSecond: nonnegative(info.bytesPerSecond)
      }
    })
  })

  async function readLatestRelease() {
    const signal = AbortSignal.timeout(15000)
    try {
      // GitHub's public release endpoint is also used by electron-updater to avoid REST API limits.
      const response = await net.fetch(latestReleaseURL, {
        signal,
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'User-Agent': `SQL-Studio/${currentVersion}`
        }
      })
      if (!response.ok) {
        const remaining = response.headers.get('x-ratelimit-remaining')
        log(`更新版本查询 HTTP ${response.status}，剩余配额=${remaining ?? 'unknown'}`)
        if (response.status === 429 || (response.status === 403 && remaining === '0')) throw new UpdateError('UPDATE_RATE_LIMITED')
        if (response.status === 403) throw new UpdateError('UPDATE_FORBIDDEN')
        if (response.status === 404) throw new UpdateError('UPDATE_NO_RELEASE')
        throw new UpdateError('UPDATE_SERVER_ERROR')
      }
      const data = await response.json()
      const version = typeof data?.tag_name === 'string' && semver.valid(data.tag_name)
      if (!version || semver.prerelease(version) || data.draft === true || data.prerelease === true) throw new UpdateError('UPDATE_INVALID_RESPONSE')
      if (!semver.gt(version, currentVersion)) return { status: 'upToDate' }

      const installer = `SQL-Studio-Setup-${version}-${process.arch}.exe`
      release = {
        version,
        installer,
        url: `${releaseURL}/tag/${encodeURIComponent(data.tag_name)}`,
        canDownload: false
      }
      if (updater) {
        try {
          release.canDownload = matchesRelease(await updater.checkForUpdates(), version, installer)
        } catch (error) {
          // A missing/inaccessible installer manifest must not hide a valid public release.
          log(`更新安装包检查失败: ${error.stack ?? error.message}`)
        }
      }
      if (release.canDownload && downloadedVersion === version) return { status: 'downloaded', version }
      return { status: 'available', version, canDownload: release.canDownload }
    } catch (error) {
      if (error instanceof UpdateError) throw error
      log(`更新版本查询失败: ${error.stack ?? error.message}`)
      if (signal.aborted || desktopUpdateErrorCode(error) === 'UPDATE_TIMEOUT') throw new UpdateError('UPDATE_TIMEOUT', error)
      if (error instanceof SyntaxError) throw new UpdateError('UPDATE_INVALID_RESPONSE', error)
      throw new UpdateError('UPDATE_NETWORK', error)
    }
  }

  return {
    getState,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    check() {
      if (downloading) return downloading
      if (!checking) {
        release = undefined
        publish({ pending: 'check', result: undefined, progress: undefined, error: undefined })
        checking = readLatestRelease()
          .then((result) => {
            publish({ pending: undefined, result })
            return result
          })
          .catch((error) => {
            publish({ pending: undefined, error: { action: 'check', code: desktopUpdateErrorCode(error) } })
            throw error
          })
          .finally(() => {
            checking = undefined
          })
      }
      return checking
    },
    download() {
      if (downloading) return downloading
      if (!updater || checking || !release?.canDownload) throw new Error('请先检查可下载的更新')
      const { version, installer } = release
      publish({ pending: 'download', progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }, error: undefined })
      downloading = (async () => {
        const update = await updater.checkForUpdates()
        if (!matchesRelease(update, version, installer)) throw new UpdateError('UPDATE_MANIFEST_MISMATCH')
        await updater.downloadUpdate()
        downloadedVersion = version
        return { status: 'downloaded', version }
      })()
        .then((result) => {
          publish({ pending: undefined, result, progress: { ...state.progress, percent: 100, bytesPerSecond: 0 } })
          return result
        })
        .catch((error) => {
          publish({ pending: undefined, error: { action: 'download', code: desktopUpdateErrorCode(error) } })
          throw error
        })
        .finally(() => {
          downloading = undefined
        })
      return downloading
    },
    openRelease() {
      return shell.openExternal(release?.url ?? releaseURL)
    },
    install(shutdown) {
      if (!updater || !downloadedVersion || downloadedVersion !== release?.version || checking || downloading) throw new Error('请先下载更新')
      return shutdown(() => {
        updater.once('error', () => app.quit())
        updater.quitAndInstall(false, true)
      })
    }
  }
}
