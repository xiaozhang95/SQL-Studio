# 公共 hooks

- [useThemePreference](useThemePreference/README.md)：系统及用户主题、界面字号、语言与偏好配置的显式保存、应用及状态。
- [useTranslation](useTranslation/README.md)：组件与 hooks 的界面文案翻译和语言订阅。
- [useTablePagination](useTablePagination/README.md)：统一分页尺寸、布局与当前语言的总数文案。

只有跨页面的状态逻辑进入公共层。

- [useAppSection](useAppSection/README.md)：通过 History API 切换工作区、AI 助手、监控与同步。

- [useAISettings](useAISettings/README.md)：共用AI配置表单与官方模型发现。

- [useSidebarResize](useSidebarResize/README.md)：SQL工作区与Agent共用侧栏拖拽、键盘调整和尺寸约束。
- [useSidebarWidth](useSidebarWidth/README.md)：两页共享宽度偏好，沿用工作台布局恢复与保存。
