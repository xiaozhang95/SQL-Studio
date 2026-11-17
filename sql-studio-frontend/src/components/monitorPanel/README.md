# 引擎监控面板

MonitorPanel({snapshot,history,config}) 组合概览、可选容量占比、“活动状态/状态信息”页签、四组趋势和统计卡。config 遵守 [MonitorPanelConfig](../../typings/databaseMonitor/README.md)，由引擎定义字段、单位、角色、分类及说明；组件不判定数据库类型，不请求网络。

snapshot.details 提供版本、角色、分类字段与可选采样告警。缺失明细时仍可按已返回指标展示，未知值显示“—”，不推测版本或角色。flag 明细支持 1/0、ON/OFF 和 true/false。source=counter 的概览和趋势均使用同一实际时间差；容量占比仅在有有限正上限时展示。历史及跨范围取消由页面 hook 负责。
