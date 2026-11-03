# 聊天契约

ChatEvent约束事件标签与可选内容，Entry描述纯文本/工具展示。SQL结果使用unknown并在展示边界校验。无连接选择类型、状态或方法；运行时对象守卫位于utils/json。

Event新增context/usage、model_start、思考/回答增量、user/turn_end恢复事件；Entry区分thinking与未完成片段。
