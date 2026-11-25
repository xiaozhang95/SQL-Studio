# 系统设置入口

加载及保存错误通过共享 ErrorNotice 展示，保留当前草稿。

SystemSettings 接收 AppearancePreferences（已应用主题、字号、语言、异步 onAppearanceSave 和可选 themeReady，默认 true），由 AppRail 在全局导航底部挂载。`variant="rail"` 时使用 18px 齿轮图标和 Tooltip，点击区域沿用 40px 导航按钮。默认 variant 使用同一图标加文字，供独立调用。界面文案通过 useTranslation 跟随已保存语言。

## 弹窗

- 点击入口打开标题为“系统设置”的 Ant Design Modal，沿用默认位置，宽度 920px；内容区高度为 `min(532px, 100dvh - 240px)`，随视口收缩。弹窗根节点带 `sql-studio-theme` 作用域，保证门户内的自定义变量与亮暗主题一致。
- Header 52px、Footer 56px，左右 20px；内容区 20 × 24px，各区域独立滚动。
- 左侧导航包含模型配置、外观设置、语言设置、关于软件，常规宽度 208px，按“AI”和“通用”分组。Ant Design xs 断点收为 48px 图标栏，保留可访问名称及悬停、聚焦提示。导航项高 40px，当前项使用中性底、主题色图标和左侧 2px 主色竖线。导航和内容共用同一主题底色，并用分隔线区隔。导航、卡片和说明文字的字号统一跟随全局界面字号。
- Footer 仅保留右侧的 default「取消」和 primary「保存」。
- 关闭按钮、遮罩或 Escape 放弃未提交草稿；保存成功后关闭并应用偏好。

## 内容

- AISettings 展示已添加模型卡片。添加/编辑通过横向子弹框依次选择供应商、输入 Key 自动加载模型，无已有选择时默认选中第一项，用户可另选，再合入设置草稿；编辑和刷新保留已有选择。同供应商可添加不同模型，相同供应商与模型 ID 不得重复。
- 首条已添加记录自动成为默认模型。模型卡展示品牌图标、名称、模型 ID、默认模型单选项、编辑和删除。卡片统一使用中性边框，默认卡使用浅色底和「默认」单选标记。列表上方为「已添加模型」标题，下方为左对齐虚线「添加模型」。删除需确认。
- 主题提供 system/light/dark 三张带工作区缩略预览的卡片，依次为「跟随系统/亮色/暗色」，跟随系统预览并列展示亮暗两套；字号为 small/standard/large，对应「较小（12px）/标准（14px）/稍大（16px）」，预览使用 96px 高的 SQL Studio / 数据查询示例。
- 语言卡片使用「你好，世界 / 数据库工作区」和「Hello, world / Database workspace」预览，底部为原生单选和语言名称。主题、字号和语言卡片均可整张点击，保留原生 Radio 的键盘操作，并随宽度换行。卡片统一使用中性边框，原生 Radio 圆点标记当前选项。选择只更新弹框草稿，切换左侧选项保留输入。
- [关于软件](components/about/README.md)只展示「当前版本 + 版本号」，仅 Electron 提供检查更新和查看控制台。安装版下载时用圆形进度环替换下载按钮的图标，重新打开设置会恢复当前下载状态。
- 总保存仅提交有变化的分区，保存完成后关闭。冲突时读取对应分区最新设置，其他失败保留可编辑草稿。忙碌时禁用控件、关闭按钮、遮罩关闭和 Escape。

[useSystemSettings](hooks/useSystemSettings/README.md) 管理草稿、模型加载与统一提交；[settings](constant/settings/README.md) 集中导航类型和弹框布局尺寸。

[appearanceCards](components/appearanceCards/README.md) 提供共用的受控单选卡片；[themePreview](components/themePreview/README.md) 用原生主题 token 绘制装饰性工作区缩略图，不读取业务数据。

主题、字号、语言和模型卡片的按钮层级沿用全局规范：每个弹窗只有一个 primary「保存」，其余操作使用 default、text 或图标按钮。
