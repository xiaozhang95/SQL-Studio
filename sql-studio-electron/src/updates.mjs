import { existsSync } from 'node:fs'
import path from 'node:path'

import { app, net, shell } from 'electron'
import electronUpdater from 'electron-updater'
import semver from 'semver'

const releaseURL = 'https://github.com/xiaozhang95/SQL-Studio/releases'
const latestReleaseAPI = 'https://api.github.com/repos/xiaozhang95/SQL-Studio/releases/latest'

export function createDesktopUpdates(log) {
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

  async function readLatestRelease() {
    const response = await net.fetch(latestReleaseAPI, { signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!response.ok) throw new Error(`GitHub Release HTTP ${response.status}`)
    const data = await response.json()
    const version = typeof data?.tag_name === 'string' && semver.valid(data.tag_name)
    if (!version || data.draft !== false || data.prerelease !== false || !Array.isArray(data.assets)) throw new Error('无效的 GitHub 正式发行版')
    if (!semver.gt(version, app.getVersion())) return { status: 'upToDate' }

    const installer = `SQL-Studio-Setup-${version}-${process.arch}.exe`
    const assets = data.assets.map((asset) => asset?.name)
    release = {
      version,
      installer,
      url: `${releaseURL}/tag/${encodeURIComponent(data.tag_name)}`,
      canDownload: Boolean(updater && assets.includes('latest.yml') && assets.includes(installer))
    }
    if (release.canDownload && downloadedVersion === version) return { status: 'downloaded', version }
    return { status: 'available', version, canDownload: release.canDownload }
  }

  return {
    check() {
      if (downloading) return downloading
      if (!checking) {
        release = undefined
        checking = readLatestRelease().finally(() => {
          checking = undefined
        })
      }
      return checking
    },
    download() {
      if (!updater || checking || !release?.canDownload) throw new Error('请先检查可下载的更新')
      const { version, installer } = release
      downloading ??= (async () => {
        const update = await updater.checkForUpdates()
        const files = update?.updateInfo.files
        if (update?.updateInfo.version !== version || files?.length !== 1 || files[0].url !== installer || !files[0].sha512) {
          throw new Error('更新清单与选定的发行版或当前架构不匹配')
        }
        await updater.downloadUpdate()
        downloadedVersion = version
        return { status: 'downloaded', version }
      })().finally(() => {
        downloading = undefined
      })
      return downloading
    },
    openRelease() {
      return shell.openExternal(release?.url ?? releaseURL)
    },
    install(shutdown) {
      if (!updater || !downloadedVersion || downloadedVersion !== release?.version || checking || downloading) throw new Error('请先下载更新')
      shutdown(() => {
        updater.once('error', () => app.quit())
        updater.quitAndInstall(false, true)
      })
    }
  }
}
