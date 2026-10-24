# 工作区状态类型

[源码](index.ts)

QueryScope 保存连接/库/表；QueryTab 另含 id/title/sql；HistoryItem 记录执行范围、SQL、时间、耗时和错误。

导入使用 `@/typings/workspace`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
