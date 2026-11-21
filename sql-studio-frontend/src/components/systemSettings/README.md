# 系统设置入口

加载及保存错误通过共享 ErrorNotice 展示，保留当前草稿。

SystemSettings 接收 AppearancePreferences（已应用主题、字号、语言、异步 onAppearanceSave 和可选 themeReady，默认 true），由 AppRail 在全局导航底部挂载。`variant="rail"` 时使用齿轮图标按钮和 Tooltip，不再占用页面 Header；默认 variant 保留图标加文字的入口，供独立调用。界面文案通过 useTranslation 跟随已保存语言。

## 弹窗

- 点击入口打开标题为“系统设置”的 Ant Design Modal，沿用默认位置，宽度 920px；内容区高度为 `min(532px, 100dvh - 240px)`，随视口收缩。
- Header 52px、Footer 56px，左右 20px；内容区 20 × 24px，各区域独立滚动。
- 左侧 208px 导航按“模型服务”和“偏好设置”分组，包含模型配置、外观设置、语言设置、关于软件。当前项使用中性底和主题色图标。
- Footer 左侧显示“偏好保存在当前设备，保存后立即生效”，右侧为 default「取消」和 primary「保存」。
- 关闭按钮、遮罩或 Escape 放弃未提交草稿；保存成功后关闭并应用偏好。

## 内容

- AISettings 展示已添加模型卡片。添加/编辑通过横向子弹框依次选择供应商、输入 Key 自动加载模型，无已有选择时默认选中第一项，用户可另选，再合入设置草稿；编辑和刷新保留已有选择。同供应商可添加不同模型，相同供应商与模型 ID 不得重复。
- 首条已添加记录自动成为默认模型。模型卡展示品牌图标、名称、供应商与模型 ID、默认单选、测试、编辑和删除；默认卡使用主题色边框和浅色底。列表下方为整宽虚线「添加模型」。删除需确认。
- 主题为 system/light/dark，使用带工作区缩略预览的卡片单选；字号为 small/standard/large，对应 12/13/15px 的示例文字卡片。卡片整张可选、保留原生 Radio 的键盘操作，并随宽度换行。选中卡显示主题色边框、聚焦环和右上角勾选标记。
- 语言卡片展示各自的原生名称和示例。主题、字号和语言均只更新弹框草稿，切换左侧选项保留输入。
- [关于软件](components/about/README.md)显示当前版本，仅 Electron 提供检查更新和查看控制台。安装版下载时用圆形进度环替换下载按钮的图标，重新打开设置会恢复当前下载状态。
- 总保存仅提交有变化的分区，保存完成后关闭。冲突时读取对应分区最新设置，其他失败保留可编辑草稿。忙碌时禁用控件、关闭按钮、遮罩关闭和 Escape。

[useSystemSettings](hooks/useSystemSettings/README.md) 管理草稿、模型加载与统一提交；[settings](constant/settings/README.md) 集中导航类型和弹框布局尺寸。

[appearanceCards](components/appearanceCards/README.md) 提供共用的受控单选卡片；[themePreview](components/themePreview/README.md) 用原生主题 token 绘制装饰性工作区缩略图，不读取业务数据。

主题、字号、语言和模型卡片的按钮层级沿用全局规范：每个弹窗只有一个 primary「保存」，其余操作使用 default、text 或图标按钮。