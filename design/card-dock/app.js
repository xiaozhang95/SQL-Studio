(() => {
  const app = document.getElementById('app')
  const params = new URLSearchParams(location.search)
  const dockThemeIcon = document.getElementById('dock-theme-icon')

  const setTheme = (theme) => {
    app.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    dockThemeIcon?.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon')
    document.querySelectorAll('.theme-option').forEach((option) => {
      const thumb = option.querySelector('.theme-thumb')
      option.classList.toggle('active', theme === 'dark' ? Boolean(thumb?.classList.contains('dark')) : Boolean(thumb?.classList.contains('light')))
    })
  }

  const setScreen = (screen) => {
    const dockScreen = screen.startsWith('redis-') ? 'workspace' : screen
    document.querySelectorAll('.screen').forEach((item) => {
      item.classList.toggle('active', item.dataset.screen === screen)
    })
    document.querySelectorAll('.dock-item[data-screen]').forEach((item) => {
      const active = item.dataset.screen === dockScreen
      item.classList.toggle('is-active', active)
      if (active) item.setAttribute('aria-current', 'page')
      else item.removeAttribute('aria-current')
    })
  }

  const initialTheme = params.get('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  setTheme(initialTheme === 'dark' ? 'dark' : 'light')
  const initialScreen = params.get('screen') || 'workspace'
  setScreen(document.querySelector(`.screen[data-screen="${initialScreen}"]`) ? initialScreen : 'workspace')

  const toggleTheme = () => setTheme(app.dataset.theme === 'dark' ? 'light' : 'dark')
  document.getElementById('dock-theme')?.addEventListener('click', toggleTheme)

  document.querySelectorAll('.dock-item[data-screen]').forEach((button) => {
    button.addEventListener('click', () => setScreen(button.dataset.screen))
  })

  document.querySelectorAll('[data-screen-link]').forEach((button) => {
    button.addEventListener('click', () => setScreen(button.dataset.screenLink))
  })

  const toast = (message) => {
    document.querySelector('.prototype-toast')?.remove()
    const element = document.createElement('div')
    element.className = 'prototype-toast'
    element.textContent = message
    document.body.appendChild(element)
    requestAnimationFrame(() => element.classList.add('show'))
    window.setTimeout(() => {
      element.classList.remove('show')
      window.setTimeout(() => element.remove(), 200)
    }, 1600)
  }


  const connectionModal = document.getElementById('connection-modal')
  const settingsModal = document.getElementById('settings-modal')

  const closeModals = () => {
    document.querySelectorAll('.modal-layer.open').forEach((layer) => layer.classList.remove('open'))
  }

  const openModal = (layer) => {
    if (!layer) return
    closeModals()
    layer.classList.add('open')
  }

  document.getElementById('new-connection')?.addEventListener('click', () => openModal(connectionModal))
  document.getElementById('dock-settings')?.addEventListener('click', () => openModal(settingsModal))
  document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals))
  document.querySelectorAll('.modal-layer').forEach((layer) => {
    layer.addEventListener('click', (event) => {
      if (event.target === layer) layer.classList.remove('open')
    })
  })

  const selectSettingsPanel = (panel) => {
    document.querySelectorAll('[data-settings-panel]').forEach((item) => {
      item.classList.toggle('active', item.dataset.settingsPanel === panel)
    })
    document.querySelectorAll('[data-panel]').forEach((section) => {
      section.hidden = section.dataset.panel !== panel
    })
    const content = settingsModal?.querySelector('.settings-content')
    if (content) content.scrollTop = 0
  }

  document.querySelectorAll('[data-settings-panel]').forEach((item) => {
    item.addEventListener('click', () => selectSettingsPanel(item.dataset.settingsPanel))
  })

  document.querySelectorAll('.theme-option').forEach((option) => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.theme-option').forEach((item) => item.classList.remove('active'))
      option.classList.add('active')
      const thumb = option.querySelector('.theme-thumb')
      if (thumb?.classList.contains('dark')) setTheme('dark')
      else if (thumb?.classList.contains('light')) setTheme('light')
    })
  })

  document.querySelectorAll('.font-option, .language-card').forEach((option) => {
    option.addEventListener('click', () => {
      const group = option.classList.contains('font-option') ? '.font-option' : '.language-card'
      document.querySelectorAll(group).forEach((item) => item.classList.remove('active'))
      option.classList.add('active')
    })
  })

  document.querySelectorAll('.engine-option[data-engine]').forEach((option) => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.engine-option').forEach((item) => item.classList.remove('active'))
      option.classList.add('active')
      const name = document.getElementById('connection-engine-name')
      const desc = document.getElementById('connection-engine-desc')
      const port = document.getElementById('connection-port-tag')
      const icon = document.getElementById('connection-engine-icon')
      if (name) name.textContent = option.dataset.engine
      if (desc) desc.textContent = option.dataset.desc
      if (port) port.textContent = `默认端口 ${option.dataset.port}`
      if (icon) icon.innerHTML = `<img src="${option.dataset.icon}" alt="" />`
    })
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModals()
  })

  if (params.get('modal') === 'connection') openModal(connectionModal)
  if (params.get('modal') === 'settings') {
    openModal(settingsModal)
    const panel = params.get('settings')
    if (panel) selectSettingsPanel(panel)
  }

  document.querySelectorAll('.qt[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.qt[data-tab]').forEach((item) => item.classList.toggle('active', item === tab))
    })
  })

  document.querySelectorAll('.rt[data-result-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rt[data-result-tab]').forEach((item) => item.classList.toggle('active', item === tab))
    })
  })

  document.querySelectorAll('.tree-row[data-toggle]').forEach((row) => {
    row.addEventListener('click', () => {
      const children = row.nextElementSibling
      if (children?.classList.contains('tree-children')) {
        const open = children.classList.toggle('collapsed') === false
        row.classList.toggle('open', open)
      }
      if (row.hasAttribute('data-select')) {
        document.querySelectorAll('.tree-row.selected').forEach((item) => item.classList.remove('selected'))
        row.classList.add('selected')
      }
    })
  })

  document.querySelectorAll('.tree-row[data-select]:not([data-toggle])').forEach((row) => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.tree-row.selected').forEach((item) => item.classList.remove('selected'))
      row.classList.add('selected')
    })
  })

  document.querySelectorAll('[data-switch]').forEach((control) => {
    control.addEventListener('click', () => {
      control.setAttribute('aria-checked', String(control.getAttribute('aria-checked') !== 'true'))
    })
  })
})()