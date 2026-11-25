# 全局应用导航

[源码](index.tsx)

左侧 56px Rail 与右侧面板共用当前亮暗主题的 `colorBgContainer`，右沿使用 `colorBorderSecondary` 分隔。顶部从工作区入口开始排列四个页面入口，底部提供亮暗主题切换和系统设置。

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

- 导航按钮使用 `aria-current="page"` 标记当前页面。当前项使用 `--surface-selected` 中性底、默认图标色和左侧主色竖线。当前项悬停时保持选中底，其余项沿用 Ant Design 文本按钮的悬停填充。悬停均显示 Tooltip。
- 监控指标和同步数据库入口与连接右键菜单共用 [StudioIcon](../studioIcon/README.md) 的图标定义。
- 主题按钮保存与当前相反的主题，保留现有字号和语言；保存期间显示加载态。
- 系统设置使用 18px 线框齿轮图标，通过 `SystemSettings variant="rail"` 打开设置弹窗。
- 只在桌面外壳内使用；窄屏由布局隐藏文字，不隐藏入口。

## 边界

组件不读取工作区数据、不直接导航，所有跳转由 App 传入；主题保存失败时保持当前主题，不额外提示。
