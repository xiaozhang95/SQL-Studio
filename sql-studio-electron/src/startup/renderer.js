const parameters = new URLSearchParams(location.search)
const english = parameters.get('language') === 'en-US'
document.documentElement.lang = english ? 'en-US' : 'zh-CN'
document.querySelector('.loading').setAttribute('aria-label', english ? 'Starting SQL Studio' : '正在启动 SQL Studio')
document.documentElement.dataset.theme = parameters.get('theme') === 'dark' ? 'dark' : 'light'
document.querySelector('.logo').src = parameters.get('icon') || ''
window.sqlStudioStartup.onTheme((theme) => {
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme
})

window.sqlStudioStartup.onStage((stage) => {
  if (!['service', 'workspace', 'ready', 'error'].includes(stage)) return
  document.querySelector('main').setAttribute('aria-busy', String(stage !== 'ready' && stage !== 'error'))
  if (stage === 'ready') document.body.classList.add('is-ready')
  if (stage === 'error') document.body.classList.add('is-error')
})
