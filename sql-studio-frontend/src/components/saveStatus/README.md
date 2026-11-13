# 配置保存状态

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

SaveStatus 由工作区和 Agent 共用，接收 saving、可选 error 和 label（默认“正在保存工作区…”）。仅 saving=true 且无 error 时展示 LoadingOutlined 旋转图标，不展示常驻文字、恢复状态、完成勾选或失败状态；空闲和失败时返回 null，不占位。Tooltip 与 aria-label 使用 label，aria-live 提供状态通知，组件不承载持久化逻辑。

工作区与对话页在右侧“系统设置”入口前使用本组件，只在恢复完成后传入保存状态。保存失败由原有页面横幅或错误区域展示，隐藏 loading 不代表故障恢复。
