(() => {
  const app = document.getElementById('app');
  const reviewBar = document.getElementById('review-bar');
  const settingsModal = document.getElementById('settings-modal');
  const connectionModal = document.getElementById('connection-modal');
  const railThemeIcon = document.getElementById('rail-theme-icon');
  const reviewThemeIcon = document.getElementById('review-theme-icon');
  const reviewThemeLabel = document.getElementById('review-theme-label');

  const params = new URLSearchParams(location.search);
  let originalTheme = 'light';

  const engineData = {
    mysql: { name: 'MySQL', port: 3306, icon: 'assets/mysql.svg' },
    mariadb: { name: 'MariaDB', port: 3306, icon: 'assets/mariadb.svg' },
    postgresql: { name: 'PostgreSQL', port: 5432, icon: 'assets/postgresql.svg' },
    greptimedb: { name: 'GreptimeDB', port: 4002, icon: 'assets/greptimedb.svg' },
    redis: { name: 'Redis', port: 6379, icon: 'assets/redis.svg' }
  };

  const setTheme = (theme, remember = true) => {
    app.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const isDark = theme === 'dark';
    railThemeIcon.setAttribute('href', isDark ? '#i-sun' : '#i-moon');
    reviewThemeIcon.setAttribute('href', isDark ? '#i-sun' : '#i-moon');
    reviewThemeLabel.textContent = isDark ? '亮色' : '暗色';
    document.querySelectorAll('[data-theme-option]').forEach((option) => {
      option.classList.toggle('is-selected', option.dataset.themeOption === theme);
    });
    if (remember) {
      try {
        localStorage.setItem('sql-studio-design-theme', theme);
      } catch {
        /* local files may block storage */
      }
    }
  };

  const initialTheme = params.get('theme') || (() => {
    try {
      return localStorage.getItem('sql-studio-design-theme');
    } catch {
      return null;
    }
  })() || 'light';
  setTheme(initialTheme, false);

  const toggleTheme = () => setTheme(app.dataset.theme === 'dark' ? 'light' : 'dark');
  document.getElementById('rail-theme').addEventListener('click', toggleTheme);
  document.getElementById('review-theme').addEventListener('click', toggleTheme);

  /* --------------------------------------------------------------------- */
  /* Screens                                                                */
  /* --------------------------------------------------------------------- */
  const setScreen = (screen, updateHash = true) => {
    document.querySelectorAll('.screen').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.screen === screen);
    });
    document.querySelectorAll('.rail-btn[data-target], .review-btn[data-target]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.target === screen);
    });
    if (updateHash) {
      try {
        history.replaceState(null, '', `#${screen}`);
      } catch {
        location.hash = screen;
      }
    }
    const pageScroll = document.querySelector('.screen.is-active .page-scroll');
    if (pageScroll) pageScroll.scrollTop = 0;
  };

  document.querySelectorAll('[data-target]').forEach((button) => {
    button.addEventListener('click', () => setScreen(button.dataset.target));
  });

  const initialScreen = (params.get('screen') || location.hash.replace(/^#/, '') || 'workspace');
  setScreen(document.querySelector(`.screen[data-screen="${initialScreen}"]`) ? initialScreen : 'workspace', false);

  /* --------------------------------------------------------------------- */
  /* Review bar visibility                                                  */
  /* --------------------------------------------------------------------- */
  const hideReview = () => document.body.classList.add('clean');
  const showReview = () => document.body.classList.remove('clean');
  document.getElementById('hide-review').addEventListener('click', hideReview);

  /* --------------------------------------------------------------------- */
  /* Modals                                                                 */
  /* --------------------------------------------------------------------- */
  let modalReturnFocus = null;

  const openLayer = (layer) => {
    modalReturnFocus = document.activeElement;
    layer.classList.add('is-open');
    layer.querySelector('.modal')?.focus?.();
  };

  const closeLayer = (layer) => {
    layer.classList.remove('is-open');
    modalReturnFocus?.focus?.();
  };

  const openSettings = () => {
    originalTheme = app.dataset.theme;
    openLayer(settingsModal);
  };

  const closeSettings = ({ keepTheme = false } = {}) => {
    closeLayer(settingsModal);
    if (!keepTheme) setTheme(originalTheme, false);
  };

  document.querySelectorAll('[data-open-settings], #open-settings').forEach((button) => {
    button.addEventListener('click', openSettings);
  });
  document.querySelectorAll('[data-close-settings]').forEach((button) => {
    button.addEventListener('click', () => {
      const keepTheme = button.classList.contains('btn-primary');
      closeSettings({ keepTheme });
      if (keepTheme) setTheme(app.dataset.theme);
    });
  });
  settingsModal.addEventListener('click', (event) => {
    if (event.target === settingsModal) closeSettings();
  });

  document.querySelectorAll('.nav-item[data-settings-section]').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item[data-settings-section]').forEach((node) => {
        node.classList.toggle('is-active', node === item);
      });
      document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.settingsPanel !== item.dataset.settingsSection;
      });
      settingsModal.querySelector('.modal-content').scrollTop = 0;
    });
  });

  document.querySelectorAll('[data-theme-option]').forEach((option) => {
    option.addEventListener('click', () => setTheme(option.dataset.themeOption, false));
  });

  const openConnection = () => openLayer(connectionModal);
  document.querySelectorAll('[data-open-connection]').forEach((button) => {
    button.addEventListener('click', openConnection);
  });
  document.querySelectorAll('[data-close-connection]').forEach((button) => {
    button.addEventListener('click', () => closeLayer(connectionModal));
  });
  connectionModal.addEventListener('click', (event) => {
    if (event.target === connectionModal) closeLayer(connectionModal);
  });

  document.querySelectorAll('.engine-option[data-engine]').forEach((option) => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.engine-option[data-engine]').forEach((node) => {
        node.classList.toggle('is-active', node === option);
      });
      const engine = engineData[option.dataset.engine];
      if (!engine) return;
      document.getElementById('connection-engine-name').textContent = engine.name;
      document.getElementById('connection-engine-icon').innerHTML = `<img src="${engine.icon}" alt="" />`;
      document.getElementById('connection-port-tag').textContent = `默认端口 ${engine.port}`;
      const portInput = document.querySelector('.connection-form input[value="3306"], .connection-form input[value="5432"], .connection-form input[value="4002"], .connection-form input[value="6379"]');
      if (portInput) portInput.value = String(engine.port);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (settingsModal.classList.contains('is-open')) closeSettings();
      if (connectionModal.classList.contains('is-open')) closeLayer(connectionModal);
    }
    if (event.target.matches('input, textarea, [contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'h') {
      document.body.classList.toggle('clean');
    }
    if (['1', '2', '3', '4'].includes(event.key)) {
      setScreen(['workspace', 'agent', 'monitor', 'sync'][Number(event.key) - 1]);
    }
  });

  /* --------------------------------------------------------------------- */
  /* Workspace tabs                                                         */
  /* --------------------------------------------------------------------- */
  const tabbar = document.querySelector('.tabbar');

  const activateTab = (tab) => {
    document.querySelectorAll('[data-tab]').forEach((node) => {
      const active = node === tab;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-selected', String(active));
    });
  };

  tabbar.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close-tab]');
    if (close) {
      event.stopPropagation();
      const tab = close.closest('[data-tab]');
      const wasActive = tab.classList.contains('is-active');
      const next = tab.nextElementSibling?.matches('[data-tab]') ? tab.nextElementSibling : tab.previousElementSibling;
      tab.remove();
      if (wasActive && next?.matches('[data-tab]')) activateTab(next);
      return;
    }
    const tab = event.target.closest('[data-tab]');
    if (tab) activateTab(tab);
  });

  document.querySelectorAll('[data-new-query]').forEach((button) => {
    button.addEventListener('click', () => {
      const tabs = [...document.querySelectorAll('[data-tab]')];
      const index = tabs.length + 1;
      const tab = document.createElement('div');
      tab.className = 'wtab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = 0;
      tab.dataset.tab = '';
      tab.innerHTML = `<svg class="icon"><use href="#i-code" /></svg><span class="label"><span class="tab-context">sql_studio_demo</span> · 查询 ${index}</span><button class="close" title="关闭标签" data-close-tab><svg class="icon"><use href="#i-x" /></svg></button>`;
      tabbar.insertBefore(tab, tabbar.querySelector('.tabbar-add'));
      activateTab(tab);
    });
  });

  /* --------------------------------------------------------------------- */
  /* Object tree                                                            */
  /* --------------------------------------------------------------------- */
  document.querySelectorAll('.tree-row[data-toggle]').forEach((row) => {
    const toggleChildren = () => {
      const children = row.nextElementSibling;
      if (!children?.classList.contains('tree-children')) return;
      const open = !row.classList.contains('is-open');
      row.classList.toggle('is-open', open);
      row.setAttribute('aria-expanded', String(open));
      children.classList.toggle('is-collapsed', !open);
    };
    row.addEventListener('click', toggleChildren);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleChildren();
      }
    });
  });

  document.querySelectorAll('.tree-row[data-select]').forEach((row) => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.tree-row.is-selected').forEach((node) => node.classList.remove('is-selected'));
      row.classList.add('is-selected');
    });
  });

  /* --------------------------------------------------------------------- */
  /* Switches                                                               */
  /* --------------------------------------------------------------------- */
  document.querySelectorAll('[data-switch], .switch[role="switch"]').forEach((control) => {
    control.addEventListener('click', () => {
      const checked = !control.classList.contains('is-checked');
      control.classList.toggle('is-checked', checked);
      control.setAttribute('aria-checked', String(checked));
    });
  });

  /* --------------------------------------------------------------------- */
  /* Result tabs                                                            */
  /* --------------------------------------------------------------------- */
  const resultTabList = document.querySelector('.result-head');
  const setResultTab = (tabName) => {
    document.querySelectorAll('.result-tab[data-result-tab]').forEach((tab) => {
      const active = tab.dataset.resultTab === tabName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-result-content]').forEach((node) => {
      const kind = node.dataset.resultContent;
      node.hidden = !(kind === tabName || (tabName === 'result2' && kind === 'result'));
    });
  };
  resultTabList?.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-result-tab]');
    if (tab) setResultTab(tab.dataset.resultTab);
  });

  /* --------------------------------------------------------------------- */
  /* Monitor tabs                                                           */
  /* --------------------------------------------------------------------- */
  document.querySelectorAll('[data-monitor-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-monitor-tab]').forEach((node) => {
        node.classList.toggle('is-active', node === tab);
      });
      document.querySelectorAll('[data-monitor-view]').forEach((view) => {
        view.hidden = view.dataset.monitorView !== tab.dataset.monitorTab;
      });
    });
  });

  /* --------------------------------------------------------------------- */
  /* Sync state                                                             */
  /* --------------------------------------------------------------------- */
  const syncConfig = document.getElementById('sync-config-view');
  const syncProgress = document.getElementById('sync-progress-view');
  const syncSteps = document.querySelectorAll('.stepper-panel .step');
  const syncPlan = document.getElementById('sync-plan');
  const syncCheck = document.getElementById('sync-check');
  const syncStatusDot = document.getElementById('sync-status-dot');
  const syncStatusLabel = document.getElementById('sync-status-label');
  let syncChecked = false;

  const setSyncSteps = (done, active) => {
    syncSteps.forEach((step, index) => {
      step.classList.toggle('is-done', done.includes(index));
      step.classList.toggle('is-active', index === active);
      const num = step.querySelector('.step-num');
      if (num) num.innerHTML = done.includes(index) ? '<svg class="icon" style="width:10px;height:10px"><use href="#i-check"/></svg>' : String(index + 1);
    });
  };

  const setSyncStatus = (label, done) => {
    syncStatusLabel.textContent = label;
    syncStatusDot.classList.toggle('is-muted', !done);
  };

  const showSyncProgress = () => {
    syncConfig.hidden = true;
    syncProgress.hidden = false;
    setSyncSteps([0, 1], 2);
    setSyncStatus('已完成', true);
    document.querySelector('.screen[data-screen="sync"] .page-scroll').scrollTop = 0;
  };

  syncCheck?.addEventListener('click', () => {
    if (!syncChecked) {
      syncChecked = true;
      syncPlan.hidden = false;
      setSyncSteps([0], 1);
      setSyncStatus('检查通过', true);
      syncCheck.innerHTML = '<svg class="icon fill"><use href="#i-play" /></svg>开始同步';
      syncCheck.dataset.stage = 'start';
      return;
    }
    showSyncProgress();
  });

  document.getElementById('sync-back')?.addEventListener('click', () => {
    syncChecked = false;
    syncProgress.hidden = true;
    syncConfig.hidden = false;
    syncPlan.hidden = true;
    setSyncSteps([], 0);
    setSyncStatus('未开始', false);
    syncCheck.innerHTML = '<svg class="icon"><use href="#i-check-circle" /></svg>同步检查';
    delete syncCheck.dataset.stage;
  });

  document.getElementById('sync-data-check')?.addEventListener('click', (event) => {
    const checked = !event.currentTarget.classList.contains('is-checked');
    event.currentTarget.classList.toggle('is-checked', checked);
    event.currentTarget.setAttribute('aria-checked', String(checked));
    if (syncChecked) {
      syncChecked = false;
      syncPlan.hidden = true;
      setSyncSteps([], 0);
      setSyncStatus('未开始', false);
      syncCheck.innerHTML = '<svg class="icon"><use href="#i-check-circle" /></svg>同步检查';
    }
  });

  /* --------------------------------------------------------------------- */
  /* Round navigation                                                       */
  /* --------------------------------------------------------------------- */
  document.querySelectorAll('.round-tick').forEach((tick) => {
    tick.addEventListener('click', () => {
      document.querySelectorAll('.round-tick').forEach((node) => node.classList.toggle('is-active', node === tick));
    });
  });

  /* --------------------------------------------------------------------- */
  /* URL modes for screenshots                                              */
  /* --------------------------------------------------------------------- */
  if (params.get('clean') === '1') document.body.classList.add('clean');

  if (params.get('open') === 'settings') {
    openSettings();
    const section = params.get('settings');
    if (section) {
      const navItem = document.querySelector(`[data-settings-section="${section}"]`);
      navItem?.click();
    }
  }
  if (params.get('open') === 'connection') openConnection();
  if (params.get('sync') === 'plan') syncCheck?.click();
  if (params.get('sync') === 'progress') showSyncProgress();
  if (params.get('monitor') === 'status') {
    document.querySelector('[data-monitor-tab="status"]')?.click();
  }
  if (params.get('agent') === 'write') {
    requestAnimationFrame(() => {
      const transcript = document.querySelector('.chat-transcript');
      if (transcript) transcript.scrollTop = transcript.scrollHeight;
    });
  }
  if (params.get('agent') === 'empty') {
    document.getElementById('chat-welcome').hidden = false;
    document.querySelector('.chat-transcript').hidden = true;
    document.querySelectorAll('.history-item.is-active').forEach((item) => item.classList.remove('is-active'));
    const agentScreen = document.querySelector('.screen[data-screen="agent"]');
    const sessionCrumb = agentScreen?.querySelector('.crumb span:last-child');
    if (sessionCrumb) sessionCrumb.textContent = '新会话';
    const roundNav = agentScreen?.querySelector('.round-nav');
    if (roundNav) roundNav.hidden = true;
  }
})();