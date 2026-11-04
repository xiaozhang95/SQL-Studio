# answerTables

answerTables(text:string):AnswerPart[] 安全分割回答文本、合法JSON二维表格及Markdown管道表格。JSON既支持json/无语言围栏，也支持说明文字中直接输出的裸对象、多个表格与不同字段顺序。逐字符匹配外层对象，正确处理字符串内的大括号、引号和反斜线；JSON.parse后仍须通过readResult行列校验。精确数值字符串、NULL、空字符串、重复列及truncated保持原样，不补造未返回的数据。

Markdown需要表头与至少三横杠分隔行，支持转义管道和行内代码。代码围栏支持反引号和波浪号，结束标记必须同类且不短于开始标记；行内代码和其他语言代码示例不转换为表格。普通JSON、行列不匹配和损坏的完整JSON保留原内容，不执行HTML。

返回text/table/code/pending-table判别联合，供渲染与Excel导出使用。未闭合的结果对象返回pending-table，携带已收到原文，由AnswerContent在生成时显示整理提示，结束后展示未完成说明和可展开原文；完整有效JSON无需等待围栏结束即可显示表格。非表格代码保留原始内容与语言。无请求、缓存或SQL执行。
