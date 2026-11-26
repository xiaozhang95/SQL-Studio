# 公共组件

- [desktopTitleBar](desktopTitleBar/README.md)：Electron 专用标题栏，使用主题背景和 1px 下沿分隔线，Windows 将标题左对齐至下方搜索框外边缘。
- [appRail](appRail/README.md)：全局左侧导航、主题切换和系统设置入口，底色与右侧面板一致。
- [studioIcon](studioIcon/README.md)：与应用视觉稿一致的线性 SVG 图标，供 Rail、Header 和对象树使用。
- [pageErrorBanner](pageErrorBanner/README.md)：工作区及各功能页共用的错误通栏。
- [databasePage](databasePage/README.md)：监控与同步共用的内容布局。
- [engineIcon](engineIcon/README.md)：对象树、连接选择及数据库页面共用的引擎图标。
- [errorNotice](errorNotice/README.md)：页面、弹框和抽屉共用的错误提示。
- [pageErrors](pageErrors/README.md)：将子区域的操作错误登记到页面错误通栏。
- [deleteDialog](deleteDialog/README.md) 为数据行、Redis 键、执行历史及 AI 会话提供带目标范围的确认弹框。
- [deleteConfirmation](deleteConfirmation/README.md) 为模型和表字段草稿提供按钮旁的确认气泡。

- [sidebarWidthProvider](sidebarWidthProvider/README.md)：工作台与Agent共享的侧栏宽度状态。
- [sidebarControls](sidebarControls/README.md)：对象栏、Redis 工具和会话栏共用的标题、操作与搜索布局。

- [aiSettings](aiSettings/README.md)：已添加模型列表，通过子弹框选择供应商、填写 Key 并明确选择模型；按供应商与模型去重，由设置统一保存。
- [aiProviderIcon](aiProviderIcon/README.md)：服务商图标。

- [systemSettings](systemSettings/README.md)：全局共用的系统设置弹框，窄窗口使用图标分类栏，包含模型配置、外观设置、语言设置和关于软件，检查更新仅在桌面端显示。

- [contentLoading](contentLoading/README.md)：工作台与 AI 助手共用的内容区加载及结果刷新提示。

- [contentCard](contentCard/README.md)：内容与代码卡片的统一外框。
- [resizableTable](resizableTable/README.md)：业务表格统一的可拖拽列宽入口，固定列保持原宽。
- [emptyStateIcon](emptyStateIcon/README.md)：空态图标尺寸与主题色。
- [dropdownChevron](dropdownChevron/README.md)：下拉箭头尺寸、颜色与禁用态。

- [monitorPanel](monitorPanel/README.md) 与 [monitorTrendChart](monitorTrendChart/README.md)：跨数据库共享监控布局及真实采样趋势。
