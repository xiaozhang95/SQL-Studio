# AI 配置面板

AISettings({themeMode,onDone,onBusyChange}) 直接嵌入 SystemSettings 的上方，横向表单只包含服务商、API Key 和模型三项；当前服务商列表仅 DeepSeek。服务商及模型选项显示品牌图标，Key 带钥匙图标，模型右侧提供加载列表按钮。

挂载时调用 useAISettings.show() 读取同一个 ai 分区；已保存 Key 时加载模型，首次输入 Key 停顿后自动加载，也可手动重试。模型错误在右侧控件下方展示，全局读取/保存错误显示 Alert。Key 留空保留，只有模型确实来自已加载列表才允许保存。

onDone 在成功保存或移除后关闭设置面板；onBusyChange 回报保存/移除状态，宿主在忙碌时禁止外部点击关闭。卸载取消模型加载并清理新输入的 Key。页脚保留移除、保存操作，不展示额外常驻说明。配置表单不展示地址或补全开关，保存只更新 provider/model/apiKey，原补全偏好由后端保留。
