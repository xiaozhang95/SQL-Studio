# Agent模型状态

useAISettings 返回 status、busy、loading、readError、choiceError、retry 和 chooseModel。订阅共享 ai-settings-saved、窗口 focus 及页面重新可见事件，刷新同一 ai-models 分区的脱敏状态。新请求取消旧请求，迟到或卸载响应不覆盖。chooseModel 提交 `{configId}`，切换已添加模型并刷新共享配置。读取或切换失败显示在助手顶栏下方，读取失败可重试。

添加和编辑统一由右上角系统设置处理。切换当前模型保留补全开关和其他记录。
