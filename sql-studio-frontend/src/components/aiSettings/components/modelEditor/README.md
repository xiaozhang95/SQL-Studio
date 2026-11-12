# 添加模型弹框

ModelEditor({editor,themeMode}) 展示横向供应商、API Key、模型表单；editor 为 useModelEditor 返回值，themeMode 用于品牌图标。模型下拉框右侧通过 Space.Compact 组合刷新图标按钮；输入 Key 后自动加载，也可手动刷新，加载失败提示放在模型控件下方。加载不自动选择；重复模型提示并禁用添加。新增“添加”、编辑“应用”只更新外层列表草稿，系统设置底部统一保存。取消清理输入与请求；沿用 Ant Design 默认位置、尺寸、样式。
