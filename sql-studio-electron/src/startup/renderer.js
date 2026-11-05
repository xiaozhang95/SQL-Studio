const parameters = new URLSearchParams(location.search)
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
