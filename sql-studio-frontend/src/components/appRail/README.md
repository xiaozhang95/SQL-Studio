# 全局应用导航

[源码](index.tsx)

左侧 56px Rail，承载四个页面入口、亮暗主题切换和系统设置。页面只负责内容区，不再在顶栏重复页面导航。

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

- 导航按钮使用 `aria-current="page"` 标记当前页面。当前项悬停时保持 `--primary-soft` 底色、主题色图标和左侧主题色竖线，其他项沿用 Ant Design 的悬停样式。悬停均显示 Tooltip。
- 主题按钮保存与当前相反的主题，保留现有字号和语言；保存期间显示加载态。
- 系统设置使用 18px 线框齿轮图标，通过 `SystemSettings variant="rail"` 打开设置弹窗。
- 只在桌面外壳内使用；窄屏由布局隐藏文字，不隐藏入口。

## 边界

组件不读取工作区数据、不直接导航，所有跳转由 App 传入；主题保存失败时保持当前主题，不额外提示。
