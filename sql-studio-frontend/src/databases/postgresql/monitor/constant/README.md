# 监控只读定义

monitorConfig 遵守 MonitorPanelConfig，定义本引擎概览、统计卡、四组趋势、分类标签、字段单位及适用边界。通过所属 monitor 入口组合，不持有状态、不请求网络；累计系列明确 source=counter，未声明时为当前采样值。
