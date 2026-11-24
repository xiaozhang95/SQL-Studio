# 引擎监控面板

MonitorPanel({snapshot,history,config}) 组合概览、可选容量占比、“活动状态/状态信息”页签、四组趋势和统计卡。config 遵守 [MonitorPanelConfig](../../typings/databaseMonitor/README.md)，由引擎定义字段、单位、角色、分类及说明；组件不判定数据库类型，不请求网络。

snapshot.details 提供版本、角色、分类字段与可选采样告警。缺失明细时仍可按已返回指标展示，未知值显示“—”，不推测版本或角色。flag 明细支持 1/0、ON/OFF 和 true/false。概览按引擎定义的字段展示，运行时间等指标使用 Ant Design Statistic 的默认字号和等宽数字并带类型图标，较上次涨跌行始终预留固定行高，数值出现或消失不改变卡片高度；活动指标使用同一套统计样式。活动状态上方保留趋势采样说明。容量占比显示标签、已用/总量与 6px 进度条。活动和状态信息页签通过 Tabs.styles 配置 38px 栏高，保留原生分隔线。状态信息使用两列瀑布流（多列布局，卡片不跨列），窄屏单列，行距沿用 Ant Design Descriptions 默认值。source=counter 的概览和趋势均使用同一实际时间差；容量占比仅在有有限正上限时展示。历史及跨范围取消由页面 hook 负责。
