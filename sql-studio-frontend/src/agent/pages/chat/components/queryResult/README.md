# 查询结果表格

QueryResult({value:unknown,sql?:string,title?:string,tool?:string,showExport?:boolean,showHeader?:boolean})先通过readResult校验真实二维结果，展示Ant Design默认字体的小尺寸带边框Table：按列位置保留重复列名，固定行号、列类型提示、长文本省略/悬停、横向滚动、超过10行时限制预览高度、10/20/50/100行分页、空结果、NULL和空字符串。showHeader默认true，上方显示标题、行列数与耗时；false隐藏整个标题栏。truncated明确提示不能代表全量统计；SQL可展开并复制。原始值不转浮点。showExport默认true，执行工具结果和助手回复中的表格均提供Excel导出；助手回复仅将showHeader传false，隐藏标题栏但保留导出及必要的截断/分页提示。

工具错误交由页面头部统一显示；连接、数据库、表与字段目录直接展示表格，连接列表不展示内部ID；执行过程通过showHeader=false隐藏结果标题、图标和数量，保留表格与导出，title仍用于导出文件名。设定目标显示Descriptions卡片；其他结构以卡片内纯文本显示，不作为HTML执行。无网络、缓存或数据库执行。

二维结果、字符串目录及对象目录表格通过 Table 的 section 语义类名复用 app.scss 的内容外框。单元格保留内部网格，滚动条位于外框内，分页位于外框下方。私有 ResultTable 通过 Flex 组合可选标题、数量和表格。非表格回执、目标信息和回退文本使用同一外框样式的 Card。

结果与导出操作由Flex统一使用CHAT.spacing.block（16px），整体宽度与正文一致；组件自身不追加上下外边距。错误结果直接返回null，不留下空容器和多余间隔。结构化回退文本沿用small Card默认内边距。

所有结果表格的分页复用公共tablePaginationDefaults，使用默认32px页码及统一底栏；保留每页数量和列/行内容，不修改查询行为。
