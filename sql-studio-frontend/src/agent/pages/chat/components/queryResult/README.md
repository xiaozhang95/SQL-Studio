# 查询结果表格

QueryResult({value:unknown,sql?:string,title?:string,tool?:string})先通过readResult校验真实二维结果，展示Ant Design默认字体的小尺寸带边框Table：按列位置保留重复列名，固定行号、列类型提示、长文本省略/悬停、横向滚动、超过10行时限制预览高度、10/20/50/100行分页、空结果、NULL和空字符串。上方显示行列数与耗时，truncated明确提示不能代表全量统计；SQL可展开并复制。原始值不转浮点。

工具错误使用Alert；连接、数据库、表与字段目录直接展示带标题/数量的表格，连接列表不展示内部ID；设定目标显示Descriptions卡片；其他结构以卡片内纯文本显示，不作为HTML执行。无网络、缓存或数据库执行。

局部ConfigProvider为结果卡片提供主题蓝色标题背景、数据库图标与行悬停点缀，表头和标题保留主题正文色保证亮暗可读性；复用当前主题token，不改变全局Table/Card。结果内部滚动条继承chat-scroll的局部细滚动条。
