# 共享监控趋势图

TrendChart({title,series,history}) 接收翻译标题、只读 TrendSeries 与当前范围真实采样。普通系列直接显示，累计系列由 [monitorMetrics](../../utils/monitorMetrics/README.md) 计算每秒速率。首次速率采样显示等待说明，缺失、回退和重置保留断点；不填充或模拟历史。

鼠标移动查看最近采样，键盘左右方向键逐点查看，移出/失焦恢复最新点。时间轴使用真实时间，系列共用自适应纵轴；卡片与图例显示格式化值，折线坐标允许近似。画布尺寸由 [constant/monitor](../../constant/monitor/README.md) 提供，颜色使用主题 token，继承系统字体。不请求网络，history 归采样 hook 管理。
