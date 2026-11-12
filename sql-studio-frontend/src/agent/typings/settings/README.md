# Agent 模型状态契约

AIStatus 返回 configId（使用中的配置记录 ID）、model（实际模型 ID）、configured、source 与已添加的 models(id/name)；models.id 是配置记录 ID，name 是模型显示名称，不包含 Key。未明确选择记录时 configId/model 为空，configured=false。

AIUpdate 只包含 configId，表示在实际使用处选择已有记录；不兼容旧 apiKey/model 写入协议。模型添加、编辑、Key 管理由系统设置完成。
