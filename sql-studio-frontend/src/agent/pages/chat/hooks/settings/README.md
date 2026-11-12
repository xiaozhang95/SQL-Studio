# Agent模型状态

useAISettings 返回 status、busy、error 和 chooseModel。订阅共享 ai-settings-saved、窗口 focus 及页面重新可见事件，从同一 ai-models 分区刷新脱敏状态。新请求取消旧请求，迟到或卸载响应不覆盖。chooseModel 提交 `{configId}`，从 status.models 中切换已添加的模型记录及对应 Key。成功后更新输入区当前模型并广播共享配置事件，失败时显示错误。

添加和编辑统一由右上角系统设置处理。切换当前模型保留补全开关和其他记录。
