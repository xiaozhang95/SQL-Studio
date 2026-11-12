# Agent模型状态

useAISettings只管理status/busy/error/notice和chooseModel，不管理Key或弹窗。订阅共享ai-settings-saved、窗口focus及页面重新可见事件，从同一 ai-models 分区刷新脱敏状态；新请求取消旧请求，迟到或卸载响应不覆盖。chooseModel 仅提交新协议 `{configId}`，选择 status.models 中已添加的配置记录，后端同时切换对应记录及其独立 Key；有记录但未选择当前模型时也可明确选择，完成后广播共享配置事件。配置表单直接复用公共AISettings及useAISettings，不另建Agent Key配置。

添加/编辑统一由右上角系统设置处理，不另建 Agent 配置表单；切换当前模型保留补全开关和其他记录，不补默认模型。
