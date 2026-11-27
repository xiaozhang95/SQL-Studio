# 全局应用导航

[源码](index.tsx)

左侧 56px Rail 与右侧面板共用当前亮暗主题的 `colorBgContainer`，右沿使用 `--layout-divider` 分隔。顶部从工作区入口开始排列四个页面入口，底部提供亮暗主题切换和系统设置。

## 导出

`default AppRail`，同时导出 `AppSection` 类型。

## 参数

- `section`：当前页面，`workspace | agent | monitor | sync`。
- `themeMode`：当前实际亮暗模式，用于切换图标和目标主题。
- `onOpenWorkspace()`：打开工作区。
- `onOpenAgent()`：打开 AI 助手。
- `onOpenDatabaseSection(section, scope?)`：打开监控或同步；监控可携带当前连接范围。
- 其余 `AppearancePreferences`：`themePreference`、`fontSizePreference`、`language`、`onAppearanceSave`、`themeReady`。

## 行为

- 导航按钮使用 `aria-current="page"` 标记当前页面。当前项背景透明，左侧用 2px 主题色竖线标记。当前项图标在亮色主题用 `colorPrimary`，暗色主题用白色。普通入口使用次级文字色，悬停或按下时提升为正文色。导航锁定时竖线继续标记当前页，图标采用禁用色。悬停均显示 Tooltip。
- 侧栏按钮的键盘焦点沿用公共按钮底部短线。
- 监控指标和同步数据库入口与连接右键菜单共用 [StudioIcon](../studioIcon/README.md) 的图标定义。
- 主题按钮保存与当前相反的主题，保留现有字号和语言；保存期间显示加载态。
- Electron 启动后发现新版本时，[侧栏更新入口](components/updateIndicator/README.md)在主题分隔线上方显示下载图标。Windows 安装版点击后显示圆环进度，校验完成后可重启安装。下载、加载、进度环和重启安装与主题、设置齿轮共用 20px 的 StudioIcon 及相同描边。侧栏和设置页共用 [桌面更新状态](../../hooks/useDesktopUpdates/README.md)。
- 系统设置入口使用 [StudioIcon](../studioIcon/README.md) 的线框齿轮，与同栏图标共用 20px 尺寸，通过 `SystemSettings variant="rail"` 打开设置弹窗。
- Web 和桌面共用左侧导航；窄屏收窄导航栏并保留图标入口。

## 边界

组件不读取工作区数据、不直接导航，所有跳转由 App 传入；主题保存失败时保持当前主题，不额外提示。
