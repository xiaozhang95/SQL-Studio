# AnswerContent

text为助手回答，通过answerTables解析有效JSON二维表格及Markdown管道表格，渲染为QueryResult并通过showExport=false和showHeader=false隐藏导出按钮及标题栏（标题、行列数、耗时）。保留表格正文、分页与截断提示。其他文本安全显示，不执行HTML。损坏JSON和代码示例保留原文。模型表格不作为SQL执行。

文字、表格、代码块由满宽Flex统一使用CHAT.spacing.block（原生middle，16px）间隔，不依赖内容自己的外边距。文本仅修整块边界空白，保留块内换行；纯空白片段不渲染，防止模型空行叠加出不对称留白。
