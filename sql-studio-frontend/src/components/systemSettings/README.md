# 系统设置入口

SystemSettings({themeMode,themePreference,onThemeChange,themeReady?})在侧栏底部展示统一入口，点击向上展开菜单。DeepSeek API配置复用AISettings的读取、模型获取、保存及移除流程；外观子菜单提供跟随系统/亮色/暗色，受控themePreference，选择通过onThemeChange提交已有全局主题逻辑。themeReady默认true，未恢复时禁用外观选项。

workspace与Agent共用此组件；菜单固定在各自侧栏滚动区外，Agent窄屏历史Drawer保留同一入口。API Key仅交给已有服务与后端保存，组件不额外持久化。代码补全为全局SQL工作区设置，两个入口均可配置。不新增表单或独立配置分区，打开时重新读取共享AI设置。

底栏保留49px与分页高度对齐，移除横向分隔线；上下4px、左右统一--workspace-inset（12px）留白内使用40px圆角描边按钮，填满可用宽度。菜单移除固定宽度，使用Dropdown原生触发器宽度匹配，与按钮等宽，边框、圆角、浮层背景及阴影均由Ant Design默认样式提供，不额外包边或裁剪浮层。DeepSeek复用服务商适配器官方SVG资源，以mask保留轮廓并统一为主题文字色，所有菜单图标共用fontSize尺寸及相同图标列，图文间距沿用Menu默认间距；主菜单、外观子菜单统一40px行高，图标和文字垂直居中；外观菜单禁用选中着色，仅以勾选标记当前偏好，父级外观项保持默认颜色。Agent底部插槽抵消列表额外内边距。

子菜单行布局限定在app.scss的system-settings-menu作用域：只对真正的menu-item/submenu-title设置40px flex居中，不给子菜单外层li设置固定高度/flex；正文容器共同居中，避免外观图标与文字基线错开。

菜单图标与文字颜色改为inherit，让禁用项继承Ant Design原生禁用色；当前外观仍仅显示勾选，不增加选中底色。
