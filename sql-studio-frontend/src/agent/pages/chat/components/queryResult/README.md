# 查询结果表格

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

QueryResult({value:unknown,sql?:string,title?:string,tool?:string,showExport?:boolean,showHeader?:boolean})先通过readResult校验真实二维结果，展示主题字体的小尺寸带边框Table：按列位置保留重复列名，固定行号、列类型提示、长文本省略/悬停、横向滚动、连续展示全部返回行、超过 10 行时在固定高度内虚拟滚动、空结果、NULL和空字符串。showHeader默认true，上方显示标题、行列数与耗时；false隐藏整个标题栏。truncated明确提示不能代表全量统计；SQL可展开并复制。原始值不转浮点。showExport默认true，执行工具结果和助手回复中的表格均提供Excel导出；助手回复仅将showHeader传false，隐藏标题栏但保留导出及必要的截断提示。

工具错误交由页面头部统一显示；连接、数据库、表与字段目录直接展示表格，连接列表不展示内部ID；执行过程通过showHeader=false隐藏结果标题、图标和数量，保留表格与导出，title仍用于导出文件名。设定目标显示Descriptions卡片；其他结构以卡片内纯文本显示，不作为HTML执行。无网络、缓存或数据库执行。

二维结果、字符串目录及对象目录表格使用原生 bordered Table 和滚动条。字符串目录及对象目录的分页位于表格下方。私有 ResultTable 通过 Flex 组合可选标题、数量和表格。非表格回执、目标信息和回退文本复用公共 ContentCard。

Excel 导出位于表格标题栏右侧，使用 icon 变体按钮；结果内容由 Flex 统一使用 CHAT.spacing.block（16px），整体宽度与正文一致，组件自身不追加上下外边距。带模型恢复指令的工具失败告警由 DeepSeek 纳入最终回答，结果区跳过该告警。已执行操作的结果截断提示照常展示。错误结果直接返回null，不留下空容器和多余间隔。结构化回退文本沿用small Card默认内边距。

二维结果表格的 `#` 序号列宽度固定为 56px。最后一个数据列吸收剩余空间，横向滚动宽度仍按所有列的预设宽度合计。

目录表格复用 `useTablePagination`。二维结果可滚动访问所有返回行，查询请求及截断提示保持原有行为。

三个结果表格分支通过共享 resultTableStyles 的 section 语义样式应用 --card-shadow，与 ContentCard 的轻微阴影一致；颜色随亮暗主题切换，不对工作区主结果表格添加阴影。
