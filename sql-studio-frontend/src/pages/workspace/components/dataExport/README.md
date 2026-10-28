# 转储进度弹框

DataExport({model}) 接收 useDataExport 返回值。以 Ant Design Modal/Descriptions/Progress 展示连接、数据库、文件名、内容、对象/记录计数、字节、错误、耗时和自动滚动日志。亮暗主题继承 token，长名称换行。运行时只能取消；完成/失败/取消后关闭，关闭不执行 SQL、不切换主页面；进度按对象计算，记录为实时计数。没有完整路径时显示浏览器提供的文件名。
